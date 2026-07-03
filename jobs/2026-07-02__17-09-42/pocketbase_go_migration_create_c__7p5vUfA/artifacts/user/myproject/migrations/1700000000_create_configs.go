package migrations

import (
	"github.com/pocketbase/pocketbase/core"
	m "github.com/pocketbase/pocketbase/migrations"
	"github.com/pocketbase/pocketbase/tools/types"
)

func init() {
	m.Register(func(app core.App) error {
		// Create the "configs" collection.
		collection := core.NewBaseCollection("configs")

		// Add the "key" text field (required).
		collection.Fields.Add(&core.TextField{
			Name:     "key",
			Required: true,
		})

		// Add the "value" text field.
		collection.Fields.Add(&core.TextField{
			Name: "value",
		})

		// Make the collection publicly readable (List and View rules).
		collection.ListRule = types.Pointer("")
		collection.ViewRule = types.Pointer("")

		// Persist the collection to the database.
		if err := app.Save(collection); err != nil {
			return err
		}

		// Seed the initial records.
		records := []struct {
			key   string
			value string
		}{
			{key: "site_name", value: "My Site"},
			{key: "maintenance_mode", value: "false"},
		}

		for _, r := range records {
			record := core.NewRecord(collection)
			record.Set("key", r.key)
			record.Set("value", r.value)

			if err := app.Save(record); err != nil {
				return err
			}
		}

		return nil
	}, func(app core.App) error {
		// Down migration: delete the "configs" collection.
		collection, err := app.FindCollectionByNameOrId("configs")
		if err != nil {
			return err
		}

		return app.Delete(collection)
	})
}
