package migrations

import (
	"github.com/pocketbase/pocketbase/core"
	m "github.com/pocketbase/pocketbase/migrations"
)

func init() {
	m.Register(func(app core.App) error {
		// Locate the existing `users` auth collection that is created
		// by the built-in pocketbase migrations.
		users, err := app.FindCollectionByNameOrId("users")
		if err != nil {
			return err
		}

		// Create the `posts` base collection that references `users` via the
		// `author` relation field.
		posts := core.NewBaseCollection("posts")
		posts.Fields.Add(
			&core.TextField{Name: "title", Required: true, Max: 200},
			&core.RelationField{
				Name:         "author",
				Required:     true,
				MaxSelect:    1,
				CollectionId: users.Id,
			},
			&core.AutodateField{Name: "created", OnCreate: true},
			&core.AutodateField{Name: "updated", OnCreate: true, OnUpdate: true},
		)

		return app.Save(posts)
	}, func(app core.App) error {
		if c, err := app.FindCollectionByNameOrId("posts"); err == nil {
			if err := app.Delete(c); err != nil {
				return err
			}
		}
		return nil
	})
}
