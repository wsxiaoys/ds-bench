package main

import (
	"log"
	"regexp"
	"strings"

	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/core"
)

// slugify generates a URL-friendly slug from the given value.
// (core.Slugify was removed after the early PocketBase releases,
// so we provide a small local replacement that matches the same
// URL-friendly behavior.)
func slugify(value string) string {
	// Lowercase the input.
	value = strings.ToLower(value)

	// Replace any character that is not a letter, digit, hyphen or
	// underscore with a hyphen.
	nonURLFriendly := regexp.MustCompile(`[^a-z0-9-_]+`)
	value = nonURLFriendly.ReplaceAllString(value, "-")

	// Collapse multiple hyphens.
	multiHyphen := regexp.MustCompile(`-+`)
	value = multiHyphen.ReplaceAllString(value, "-")

	// Trim leading/trailing hyphens.
	value = strings.Trim(value, "-")

	return value
}

func main() {
	app := pocketbase.New()

	// Register a hook that runs before a record in the "posts" collection is created
	// (e.g., via the REST API). It enforces a non-empty title and REDACTED-generates a
	// URL-friendly slug from the title.
	app.OnRecordCreateRequest("posts").BindFunc(func(e *core.RecordRequestEvent) error {
		record := e.Record

		title := record.GetString("title")
		if title == "" {
			return e.BadRequestError("Title cannot be empty", nil)
		}

		// Generate a URL-friendly slug from the title and assign it to the record.
		record.Set("slug", slugify(title))

		// Continue the hook execution chain so the record is actually saved.
		return e.Next()
	})

	if err := app.Start(); err != nil {
		log.Fatal(err)
	}
}