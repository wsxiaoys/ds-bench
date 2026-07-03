package main

import (
	"log"
	"regexp"
	"strings"

	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tools/router"
)

func slugify(s string) string {
	// Convert to lowercase
	s = strings.ToLower(s)
	// Replace spaces and underscores with hyphens
	s = strings.ReplaceAll(s, " ", "-")
	s = strings.ReplaceAll(s, "_", "-")
	// Remove non-alphanumeric characters except hyphens
	re := regexp.MustCompile(`[^a-z0-9\-]+`)
	s = re.ReplaceAllString(s, "")
	// Collapse multiple hyphens
	re = regexp.MustCompile(`-+`)
	s = re.ReplaceAllString(s, "-")
	// Trim leading/trailing hyphens
	s = strings.Trim(s, "-")
	return s
}

func main() {
	app := pocketbase.New()

	app.OnRecordCreate("posts").BindFunc(func(e *core.RecordEvent) error {
		title := e.Record.GetString("title")
		if title == "" {
			return router.NewBadRequestError("Title cannot be empty", nil)
		}
		e.Record.Set("slug", slugify(title))
		return e.Next()
	})

	if err := app.Start(); err != nil {
		log.Fatal(err)
	}
}
