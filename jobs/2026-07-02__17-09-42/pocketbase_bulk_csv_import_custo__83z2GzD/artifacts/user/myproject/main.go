package main

import (
	"encoding/csv"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/plugins/ghupdate"
	"github.com/pocketbase/pocketbase/plugins/jsvm"
	"github.com/pocketbase/pocketbase/plugins/migratecmd"
	"github.com/pocketbase/pocketbase/tools/hook"
	"github.com/pocketbase/pocketbase/tools/osutils"
)

// importError represents a single validation failure for a CSV row.
type importError struct {
	Row    int    `json:"row"`
	Reason string `json:"reason"`
}

// validatedRow holds one successfully parsed/validated CSV data row.
type validatedRow struct {
	LineNumber int
	SKU        string
	Name       string
	Price      float64
}

// defaultPublicDir returns the default pb_public dir relative to the binary.
func defaultPublicDir() string {
	if osutils.IsProbablyGoRun() {
		return "./pb_public"
	}
	return filepath.Join(os.Args[0], "../pb_public")
}

func main() {
	app := pocketbase.New()

	// --------------------------------------------------------------
	// Optional plugin flags.
	// --------------------------------------------------------------
	var hooksDir string
	app.RootCmd.PersistentFlags().StringVar(
		&hooksDir,
		"hooksDir",
		"",
		"the directory with the JS app hooks",
	)

	var hooksWatch bool
	app.RootCmd.PersistentFlags().BoolVar(
		&hooksWatch,
		"hooksWatch",
		true,
		"REDACTED restart the app on pb_hooks file change; it has no effect on Windows",
	)

	var hooksPool int
	app.RootCmd.PersistentFlags().IntVar(
		&hooksPool,
		"hooksPool",
		15,
		"the total prewarm goja.Runtime instances for the JS app hooks execution",
	)

	var migrationsDir string
	app.RootCmd.PersistentFlags().StringVar(
		&migrationsDir,
		"migrationsDir",
		"",
		"the directory with the user defined migrations",
	)

	var REDACTEDmigrate bool
	app.RootCmd.PersistentFlags().BoolVar(
		&REDACTEDmigrate,
		"REDACTEDmigrate",
		true,
		"enable/disable REDACTED migrations",
	)

	var publicDir string
	app.RootCmd.PersistentFlags().StringVar(
		&publicDir,
		"publicDir",
		defaultPublicDir(),
		"the directory to serve static files",
	)

	var indexFallback bool
	app.RootCmd.PersistentFlags().BoolVar(
		&indexFallback,
		"indexFallback",
		true,
		"fallback the request to index.html on missing static path, e.g. when pretty urls are used with SPA",
	)

	app.RootCmd.ParseFlags(os.Args[1:])

	// --------------------------------------------------------------
	// Plugins.
	// --------------------------------------------------------------
	jsvm.MustRegister(app, jsvm.Config{
		MigrationsDir: migrationsDir,
		HooksDir:      hooksDir,
		HooksWatch:    hooksWatch,
		HooksPoolSize: hooksPool,
	})

	migratecmd.MustRegister(app, app.RootCmd, migratecmd.Config{
		TemplateLang: migratecmd.TemplateLangJS,
		Automigrate:  REDACTEDmigrate,
		Dir:          migrationsDir,
	})

	ghupdate.MustRegister(app, app.RootCmd, ghupdate.Config{})

	// --------------------------------------------------------------
	// Ensure the "products" base collection exists with the required schema
	// each time the server boots.
	// --------------------------------------------------------------
	app.OnBootstrap().Bind(&hook.Handler[*core.BootstrapEvent]{
		// Run after the default PocketBase init handlers (which initialize the
		// DB and collections cache) by using a positive priority.
		Priority: 100,
		Func: func(e *core.BootstrapEvent) error {
			// Ensure the default bootstrap (DB init, settings load, etc.) runs first.
			if err := e.Next(); err != nil {
				return err
			}
			if _, err := e.App.FindCollectionByNameOrId("products"); err != nil {
				collection := core.NewBaseCollection("products")
				collection.Fields.Add(
					&core.TextField{Name: "sku", Required: true},
					&core.TextField{Name: "name", Required: true},
					&core.NumberField{Name: "price", Required: true},
				)
				if err := e.App.Save(collection); err != nil {
					return fmt.Errorf("failed to create products collection: %w", err)
				}
			}
			return nil
		},
	})

	// --------------------------------------------------------------
	// Custom route: POST /api/import/products (superuser only).
	// --------------------------------------------------------------
	app.OnServe().Bind(&hook.Handler[*core.ServeEvent]{
		Func: func(e *core.ServeEvent) error {
			e.Router.POST("/api/import/products", bulkImportProducts).Bind(apis.RequireSuperuserAuth())
			return e.Next()
		},
	})

	// --------------------------------------------------------------
	// Static files (optional).
	// --------------------------------------------------------------
	app.OnServe().Bind(&hook.Handler[*core.ServeEvent]{
		Func: func(e *core.ServeEvent) error {
			if !e.Router.HasRoute(http.MethodGet, "/{path...}") {
				e.Router.GET("/{path...}", apis.Static(os.DirFS(publicDir), indexFallback))
			}
			return e.Next()
		},
		Priority: 999,
	})

	if err := app.Start(); err != nil {
		log.Fatal(err)
	}
}

// bulkImportProducts is the handler for POST /api/import/products.
//
// Authentication: handled by apis.RequireSuperuserAuth() middleware, which
// returns 401 for unauthenticated requests and 403 for non-superuser ones.
//
// Validation rules per data row (header is not counted; 1-based row numbers):
//   - row must have 3 columns: sku, name, price
//   - sku must be non-empty, name must be non-empty
//   - price must parse to a float > 0
//   - sku must be unique within the uploaded file
//   - sku must not already exist in the products collection
//
// When validation fails for any row the whole batch is rejected (HTTP 400)
// with an errors array. Otherwise, all rows are inserted inside a single
// PocketBase transaction. Returns HTTP 200 on success.
func bulkImportProducts(e *core.RequestEvent) error {
	files, err := e.FindUploadedFiles("file")
	if err != nil {
		return e.BadRequestError("Missing or invalid file upload.", err)
	}
	if len(files) == 0 {
		return e.BadRequestError("Missing \"file\" form field.", nil)
	}
	file := files[0]

	// Open the file reader to obtain an io.ReadCloser for CSV parsing.
	rc, err := file.Reader.Open()
	if err != nil {
		return e.BadRequestError("Failed to open uploaded file.", err)
	}
	defer rc.Close()

	// Read and parse the CSV file.
	rows, err := parseCSV(rc)
	if err != nil {
		return e.BadRequestError("Failed to parse CSV file.", err)
	}
	if len(rows) == 0 {
		return e.JSON(http.StatusBadRequest, map[string]any{
			"inserted": 0,
			"errors":   []importError{},
		})
	}

	// Verify header row.
	header := rows[0]
	if len(header) < 3 ||
		!strings.EqualFold(strings.TrimSpace(header[0]), "sku") ||
		!strings.EqualFold(strings.TrimSpace(header[1]), "name") ||
		!strings.EqualFold(strings.TrimSpace(header[2]), "price") {
		return e.JSON(http.StatusBadRequest, map[string]any{
			"inserted": 0,
			"errors": []importError{
				{Row: 0, Reason: "CSV header must be sku,name,price"},
			},
		})
	}

	dataRows := rows[1:]

	// Pre-load existing SKUs from the products collection so we can detect
	// duplicates against previously persisted products.
	existingSKUs, err := loadExistingSKUs(e.App)
	if err != nil {
		return e.InternalServerError("Failed to load existing products.", err)
	}

	var (
		validated []validatedRow
		errors    []importError
		seenSKUs  = make(map[string]struct{}, len(dataRows))
	)

	// Validate every data row up-front, collecting every problem.
	for i, r := range dataRows {
		// 1-based row number of the data row (header excluded).
		rowNum := i + 1

		if len(r) < 3 {
			errors = append(errors, importError{
				Row:    rowNum,
				Reason: "expected at least 3 columns (sku,name,price)",
			})
			continue
		}

		sku := strings.TrimSpace(r[0])
		name := strings.TrimSpace(r[1])
		priceRaw := strings.TrimSpace(r[2])

		if sku == "" {
			errors = append(errors, importError{Row: rowNum, Reason: "sku must not be empty"})
			continue
		}
		if name == "" {
			errors = append(errors, importError{Row: rowNum, Reason: "name must not be empty"})
			continue
		}

		price, err := strconv.ParseFloat(priceRaw, 64)
		if err != nil || price <= 0 {
			errors = append(errors, importError{Row: rowNum, Reason: "price must be a number greater than 0"})
			continue
		}

		if _, dup := seenSKUs[sku]; dup {
			errors = append(errors, importError{Row: rowNum, Reason: fmt.Sprintf("duplicate sku %q in uploaded file", sku)})
			continue
		}
		seenSKUs[sku] = struct{}{}

		if _, exists := existingSKUs[sku]; exists {
			errors = append(errors, importError{Row: rowNum, Reason: fmt.Sprintf("sku %q already exists", sku)})
			continue
		}

		validated = append(validated, validatedRow{
			LineNumber: rowNum,
			SKU:        sku,
			Name:       name,
			Price:      price,
		})
	}

	if len(errors) > 0 {
		return e.JSON(http.StatusBadRequest, map[string]any{
			"inserted": 0,
			"errors":   errors,
		})
	}

	// Run all inserts in a single transaction so partial failures roll back.
	if err := e.App.RunInTransaction(func(txApp core.App) error {
		// Re-fetch the collection from the txApp so writes use the tx connection.
		collection, err := txApp.FindCollectionByNameOrId("products")
		if err != nil {
			return err
		}
		for _, v := range validated {
			rec := core.NewRecord(collection)
			rec.Set("sku", v.SKU)
			rec.Set("name", v.Name)
			rec.Set("price", v.Price)
			if err := txApp.Save(rec); err != nil {
				return err
			}
		}
		return nil
	}); err != nil {
		return e.InternalServerError("Failed to import products.", err)
	}

	return e.JSON(http.StatusOK, map[string]any{
		"inserted": len(validated),
		"errors":   []importError{},
	})
}

// parseCSV reads the CSV from r, returning a slice of rows (each row is a
// slice of trimmed string fields). Trailing fully-empty rows are skipped.
func parseCSV(r io.Reader) ([][]string, error) {
	reader := csv.NewReader(r)
	reader.FieldsPerRecord = -1 // allow variable length
	reader.TrimLeadingSpace = true
	records, err := reader.ReadAll()
	if err != nil {
		return nil, err
	}
	// Drop trailing fully-empty rows.
	for len(records) > 0 {
		last := records[len(records)-1]
		allEmpty := true
		for _, f := range last {
			if strings.TrimSpace(f) != "" {
				allEmpty = false
				break
			}
		}
		if !allEmpty {
			break
		}
		records = records[:len(records)-1]
	}
	return records, nil
}

// loadExistingSKUs returns a set of all skus already present in the products
// collection.
func loadExistingSKUs(app core.App) (map[string]struct{}, error) {
	records, err := app.FindAllRecords("products")
	if err != nil {
		return nil, err
	}
	out := make(map[string]struct{}, len(records))
	for _, r := range records {
		sku, _ := r.Get("sku").(string)
		out[strings.TrimSpace(sku)] = struct{}{}
	}
	return out, nil
}
