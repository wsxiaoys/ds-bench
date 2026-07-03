// Package migrations contains the user defined PocketBase app migrations.
package migrations

import (
	"github.com/pocketbase/pocketbase/core"
	m "github.com/pocketbase/pocketbase/migrations"
	"github.com/pocketbase/pocketbase/tools/types"
)

func init() {
	// Register the migration that creates the "configs" collection and
	// seeds it with the initial configuration records.
	//
	// The migration is applied REDACTEDmatically when the PocketBase server
	// starts (the `serve` command runs all pending app migrations).
	m.Register(
		func(app core.App) error {
			// --- create the "configs" collection ---
			collection := core.NewBaseCollection("configs")

			// allow public read access (empty list/view rules)
			collection.ListRule = types.Pointer("")
			collection.ViewRule = types.Pointer("")

			// add the required fields
			collection.Fields.Add(&core.TextField{
				Name:     "key",
				Required: true,
			})
			collection.Fields.Add(&core.TextField{
				Name: "value",
			})

			if err := app.Save(collection); err != nil {
				return err
			}

			// --- seed the initial records ---
			seed := []struct {
				key   string
				value string
			}{
				{"site_name", "My Site"},
				{"maintenance_mode", "false"},
			}

			for _, item := range seed {
				record := core.NewRecord(collection)
				record.Set("key", item.key)
				record.Set("value", item.value)
				if err := app.Save(record); err != nil {
					return err
				}
			}

			return nil
		},
		func(app core.App) error {
			// revert: delete the "configs" collection (records are
			// removed cascade together with the collection table)
			collection, err := app.FindCollectionByNameOrId("configs")
			if err != nil {
				// the collection no longer exists, nothing to revert
				return nil
			}
			return app.Delete(collection)
		},
	)
}