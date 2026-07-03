package migrations

import (
	"github.com/pocketbase/pocketbase/core"
	m "github.com/pocketbase/pocketbase/migrations"
)

func init() {
	m.Register(func(app core.App) error {
		view := core.NewViewCollection("user_post_stats")
		view.ViewQuery = `
			SELECT
				users.id AS id,
				users.id AS user,
				users.email AS email,
				count(posts.id) AS post_count,
				cast(coalesce(max(posts.created), '') AS text) AS last_post_at
			FROM users
			LEFT JOIN posts ON posts.author = users.id
			GROUP BY users.id, users.email
		`
		return app.Save(view)
	}, func(app core.App) error {
		if c, err := app.FindCollectionByNameOrId("user_post_stats"); err == nil {
			return app.Delete(c)
		}
		return nil
	})
}
