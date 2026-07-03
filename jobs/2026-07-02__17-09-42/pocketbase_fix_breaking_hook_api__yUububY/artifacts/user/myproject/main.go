package main

import (
	"log"
	"regexp"
	"strings"

	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/core"
)

// Slugify converts a string into a URL-friendly slug.
//
// This replaces the older `core.Slugify` helper that existed in earlier
// PocketBase releases (pre-v0.23) and was removed in later versions.
func Slugify(s string) string {
	s = strings.ToLower(strings.TrimSpace(s))
	// collapse any non-alphanumeric run into a single hyphen
	s = nonSlugCharRegex.ReplaceAllString(s, "-")
	// trim leading/trailing hyphens
	s = strings.Trim(s, "-")
	return s
}

var nonSlugCharRegex = regexp.MustCompile(`[^a-z0-9]+`)

func main() {
	app := pocketbase.New()

	app.OnRecordCreateRequest("posts").BindFunc(func(e *core.RecordRequestEvent) error {
		title := e.Record.GetString("title")
		if title == "" {
			return e.BadRequestError("Title cannot be empty", nil)
		}

		e.Record.Set("slug", Slugify(title))

		return e.Next()
	})

	if err := app.Start(); err != nil {
		log.Fatal(err)
	}
}