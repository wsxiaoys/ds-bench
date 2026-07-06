package main

import (
	"encoding/csv"
	"fmt"
	"io"
	"log"
	"net/http"
	"strconv"
	"strings"

	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/core"
)

const productsCollectionName = "products"

func main() {
	app := pocketbase.New()

	app.OnServe().BindFunc(func(e *core.ServeEvent) error {
		// Register the bulk import route
		e.Router.POST("/api/import/products", importProducts).Bind(apis.RequireSuperuserAuth())

		if err := e.Next(); err != nil {
			return err
		}
		return nil
	})

	// Ensure products collection exists after bootstrap
	app.OnServe().BindFunc(func(e *core.ServeEvent) error {
		if err := ensureProductsCollection(e.App); err != nil {
			log.Printf("failed to ensure products collection: %v", err)
		}
		return e.Next()
	})

	if err := app.Start(); err != nil {
		log.Fatal(err)
	}
}

func ensureProductsCollection(app core.App) error {
	if _, err := app.FindCollectionByNameOrId(productsCollectionName); err == nil {
		return nil
	}

	col := core.NewBaseCollection(productsCollectionName)

	sku := &core.TextField{
		Name:     "sku",
		Required: true,
	}
	name := &core.TextField{
		Name:     "name",
		Required: true,
	}
	price := &core.NumberField{
		Name:     "price",
		Required: true,
	}

	col.Fields.Add(sku)
	col.Fields.Add(name)
	col.Fields.Add(price)

	if err := app.Save(col); err != nil {
		return fmt.Errorf("save collection: %w", err)
	}
	return nil
}

type rowError struct {
	Row    int    `json:"row"`
	Reason string `json:"reason"`
}

type importResponse struct {
	Inserted int        `json:"inserted"`
	Errors   []rowError `json:"errors"`
}

func importProducts(e *core.RequestEvent) error {
	files, err := e.FindUploadedFiles("file")
	if err != nil || len(files) == 0 {
		return e.BadRequestError("Missing 'file' field in multipart/form-data", nil)
	}
	file := files[0]

	rc, err := file.Reader.Open()
	if err != nil {
		return e.InternalServerError("Failed to open uploaded file", err)
	}
	defer rc.Close()

	reader := csv.NewReader(rc)
	reader.FieldsPerRecord = -1

	header, err := reader.Read()
	if err != nil {
		return e.BadRequestError("Failed to read CSV header", err)
	}

	colIdx := map[string]int{}
	for i, h := range header {
		colIdx[strings.ToLower(strings.TrimSpace(h))] = i
	}
	skuIdx, hasSku := colIdx["sku"]
	nameIdx, hasName := colIdx["name"]
	priceIdx, hasPrice := colIdx["price"]
	if !hasSku || !hasName || !hasPrice {
		return e.BadRequestError("CSV must contain sku, name, price columns", nil)
	}

	type parsedRow struct {
		rowNum int
		sku    string
		name   string
		price  float64
	}

	var parsed []parsedRow
	seenSKU := map[string]int{}
	rowNum := 0
	for {
		rowNum++
		record, err := reader.Read()
		if err == io.EOF {
			break
		}
		if err != nil {
			return e.JSON(http.StatusBadRequest, importResponse{
				Inserted: 0,
				Errors: []rowError{
					{Row: rowNum, Reason: "invalid CSV row: " + err.Error()},
				},
			})
		}

		var sku, name, priceStr string
		if skuIdx < len(record) {
			sku = strings.TrimSpace(record[skuIdx])
		}
		if nameIdx < len(record) {
			name = strings.TrimSpace(record[nameIdx])
		}
		if priceIdx < len(record) {
			priceStr = strings.TrimSpace(record[priceIdx])
		}

		if sku == "" {
			return e.JSON(http.StatusBadRequest, importResponse{
				Inserted: 0,
				Errors: []rowError{
					{Row: rowNum, Reason: "sku is required"},
				},
			})
		}
		if name == "" {
			return e.JSON(http.StatusBadRequest, importResponse{
				Inserted: 0,
				Errors: []rowError{
					{Row: rowNum, Reason: "name is required"},
				},
			})
		}

		price, perr := strconv.ParseFloat(priceStr, 64)
		if perr != nil {
			return e.JSON(http.StatusBadRequest, importResponse{
				Inserted: 0,
				Errors: []rowError{
					{Row: rowNum, Reason: "invalid price: " + perr.Error()},
				},
			})
		}
		if price <= 0 {
			return e.JSON(http.StatusBadRequest, importResponse{
				Inserted: 0,
				Errors: []rowError{
					{Row: rowNum, Reason: "price must be > 0"},
				},
			})
		}

		if prev, ok := seenSKU[sku]; ok {
			return e.JSON(http.StatusBadRequest, importResponse{
				Inserted: 0,
				Errors: []rowError{
					{Row: rowNum, Reason: fmt.Sprintf("duplicate sku '%s' (first seen at row %d)", sku, prev)},
				},
			})
		}
		seenSKU[sku] = rowNum

		parsed = append(parsed, parsedRow{
			rowNum: rowNum,
			sku:    sku,
			name:   name,
			price:  price,
		})
	}

	if len(parsed) == 0 {
		return e.JSON(http.StatusOK, importResponse{
			Inserted: 0,
			Errors:   []rowError{},
		})
	}

	collection, err := e.App.FindCollectionByNameOrId(productsCollectionName)
	if err != nil {
		return e.InternalServerError("products collection not found", err)
	}

	var errs []rowError
	for _, pr := range parsed {
		existing, ferr := e.App.FindFirstRecordByFilter(collection, "sku={:sku}", dbx.Params{"sku": pr.sku})
		if ferr == nil && existing != nil {
			errs = append(errs, rowError{Row: pr.rowNum, Reason: fmt.Sprintf("sku '%s' already exists", pr.sku)})
		}
	}
	if len(errs) > 0 {
		return e.JSON(http.StatusBadRequest, importResponse{Inserted: 0, Errors: errs})
	}

	inserted := 0
	txErr := e.App.RunInTransaction(func(txApp core.App) error {
		for _, pr := range parsed {
			rec := core.NewRecord(collection)
			rec.Set("sku", pr.sku)
			rec.Set("name", pr.name)
			rec.Set("price", pr.price)
			if saveErr := txApp.Save(rec); saveErr != nil {
				return saveErr
			}
			inserted++
		}
		return nil
	})

	if txErr != nil {
		return e.JSON(http.StatusBadRequest, importResponse{
			Inserted: 0,
			Errors: []rowError{
				{Row: 0, Reason: "transaction failed: " + txErr.Error()},
			},
		})
	}

	return e.JSON(http.StatusOK, importResponse{Inserted: inserted, Errors: []rowError{}})
}
