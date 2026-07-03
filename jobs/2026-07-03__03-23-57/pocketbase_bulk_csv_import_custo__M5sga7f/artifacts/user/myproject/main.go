package main

import (
	"database/sql"
	"encoding/csv"
	"fmt"
	"io"
	"log"
	"net/http"
	"strconv"

	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/core"
)

type ImportError struct {
	Row    int    `json:"row"`
	Reason string `json:"reason"`
}

type ValidatedRow struct {
	rowNum int
	sku    string
	name   string
	price  float64
}

func main() {
	app := pocketbase.New()

	app.OnServe().BindFunc(func(se *core.ServeEvent) error {
		// 1. Ensure "products" collection exists
		_, err := se.App.FindCollectionByNameOrId("products")
		if err != nil {
			// Collection doesn't exist, create it
			products := core.NewBaseCollection("products")
			products.Fields.Add(
				&core.TextField{
					Name:     "sku",
					Required: true,
				},
				&core.TextField{
					Name:     "name",
					Required: true,
				},
				&core.NumberField{
					Name:     "price",
					Required: true,
				},
			)
			if err := se.App.Save(products); err != nil {
				return fmt.Errorf("failed to create products collection: %w", err)
			}
		}

		// 2. Register custom POST /api/import/products route
		se.Router.POST("/api/import/products", func(e *core.RequestEvent) error {
			// Superuser Authentication check
			if e.Auth == nil {
				return e.JSON(http.StatusUnauthorized, map[string]any{
					"error": "Unauthorized",
				})
			}
			if !e.HasSuperuserAuth() {
				return e.JSON(http.StatusForbidden, map[string]any{
					"error": "Forbidden",
				})
			}

			// Get uploaded file
			file, _, err := e.Request.FormFile("file")
			if err != nil {
				return e.JSON(http.StatusBadRequest, map[string]any{
					"inserted": 0,
					"errors": []ImportError{
						{Row: 0, Reason: "Missing or invalid file field"},
					},
				})
			}
			defer file.Close()

			reader := csv.NewReader(file)

			// Read and validate header
			headerRow, err := reader.Read()
			if err != nil {
				return e.JSON(http.StatusBadRequest, map[string]any{
					"inserted": 0,
					"errors": []ImportError{
						{Row: 0, Reason: "Failed to read CSV header"},
					},
				})
			}
			if len(headerRow) != 3 || headerRow[0] != "sku" || headerRow[1] != "name" || headerRow[2] != "price" {
				return e.JSON(http.StatusBadRequest, map[string]any{
					"inserted": 0,
					"errors": []ImportError{
						{Row: 0, Reason: "Invalid CSV header. Expected 'sku,name,price'"},
					},
				})
			}

			var errorsList []ImportError
			var validatedRows []ValidatedRow
			seenSKUs := make(map[string]bool)

			dataRowNum := 0
			for {
				row, err := reader.Read()
				if err == io.EOF {
					break
				}
				dataRowNum++
				if err != nil {
					errorsList = append(errorsList, ImportError{
						Row:    dataRowNum,
						Reason: "Malformed CSV row: " + err.Error(),
					})
					continue
				}

				if len(row) < 3 {
					errorsList = append(errorsList, ImportError{
						Row:    dataRowNum,
						Reason: "Row does not have enough columns (expected 3)",
					})
					continue
				}

				sku := row[0]
				name := row[1]
				priceStr := row[2]

				// Validate price
				price, err := strconv.ParseFloat(priceStr, 64)
				var priceValid bool
				if err != nil {
					errorsList = append(errorsList, ImportError{
						Row:    dataRowNum,
						Reason: "Price must be a valid number",
					})
				} else if price <= 0 {
					errorsList = append(errorsList, ImportError{
						Row:    dataRowNum,
						Reason: "Price must be greater than 0",
					})
				} else {
					priceValid = true
				}

				// Validate SKU unique in file
				var skuFileUnique bool
				if sku == "" {
					errorsList = append(errorsList, ImportError{
						Row:    dataRowNum,
						Reason: "SKU cannot be empty",
					})
				} else if seenSKUs[sku] {
					errorsList = append(errorsList, ImportError{
						Row:    dataRowNum,
						Reason: "SKU must be unique within the uploaded file",
					})
				} else {
					seenSKUs[sku] = true
					skuFileUnique = true
				}

				if priceValid && skuFileUnique {
					validatedRows = append(validatedRows, ValidatedRow{
						rowNum: dataRowNum,
						sku:    sku,
						name:   name,
						price:  price,
					})
				}
			}

			// If we already have errors from the file parsing, we can fail early
			if len(errorsList) > 0 {
				return e.JSON(http.StatusBadRequest, map[string]any{
					"inserted": 0,
					"errors":   errorsList,
				})
			}

			var insertedCount int

			// Perform DB checks and inserts inside a single transaction
			txErr := se.App.RunInTransaction(func(txApp core.App) error {
				// Re-initialize errorsList to collect any DB validation errors
				errorsList = []ImportError{}

				// Double check SKU existence in DB for each validated row
				var finalValidatedRows []ValidatedRow
				for _, vr := range validatedRows {
					existing, err := txApp.FindFirstRecordByFilter("products", "sku = {:sku}", dbx.Params{"sku": vr.sku})
					if err == nil && existing != nil {
						errorsList = append(errorsList, ImportError{
							Row:    vr.rowNum,
							Reason: "SKU already exists in the products collection",
						})
					} else if err != nil && err != sql.ErrNoRows {
						errorsList = append(errorsList, ImportError{
							Row:    vr.rowNum,
							Reason: "Database error checking SKU existence",
						})
					} else {
						finalValidatedRows = append(finalValidatedRows, vr)
					}
				}

				if len(errorsList) > 0 {
					return fmt.Errorf("validation failed")
				}

				// Get products collection
				productsCol, err := txApp.FindCollectionByNameOrId("products")
				if err != nil {
					return fmt.Errorf("failed to find products collection: %w", err)
				}

				// Insert records
				for _, vr := range finalValidatedRows {
					record := core.NewRecord(productsCol)
					record.Set("sku", vr.sku)
					record.Set("name", vr.name)
					record.Set("price", vr.price)

					if err := txApp.Save(record); err != nil {
						return fmt.Errorf("failed to save product: %w", err)
					}
				}

				insertedCount = len(finalValidatedRows)
				return nil
			})

			if txErr != nil {
				// If the error was a validation failure, we have populated errorsList
				if len(errorsList) > 0 {
					return e.JSON(http.StatusBadRequest, map[string]any{
						"inserted": 0,
						"errors":   errorsList,
					})
				}
				// Otherwise, it was an unexpected DB error
				return e.JSON(http.StatusInternalServerError, map[string]any{
					"inserted": 0,
					"errors": []ImportError{
						{Row: 0, Reason: "Transaction failed: " + txErr.Error()},
					},
				})
			}

			return e.JSON(http.StatusOK, map[string]any{
				"inserted": insertedCount,
				"errors":   []ImportError{},
			})
		})

		return se.Next()
	})

	if err := app.Start(); err != nil {
		log.Fatal(err)
	}
}
