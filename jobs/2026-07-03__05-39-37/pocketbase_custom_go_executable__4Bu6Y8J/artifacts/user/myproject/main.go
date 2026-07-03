package main

import (
	"log"
	"regexp"
	"strings"

	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/core"
)

// slugRe matches one or more characters that are not letters or digits.
// It is used to replace separators/special characters with a single hyphen.
var slugRe = regexp.MustCompile(`[^\p{L}\p{N}]+`)

// slugify converts a title into a URL-friendly slug.
//
// e.g. "Hello, World! — My First Post" -> "hello-world-my-first-post"
func slugify(s string) string {
	s = strings.ToLower(strings.TrimSpace(s))
	s = slugRe.ReplaceAllString(s, "-")
	return strings.Trim(s, "-")
}

func main() {
	app := pocketbase.New()

	// Register a hook for the "posts" collection that runs before a record
	// is persisted (the actual DB save is performed by the final handler in
	// the chain, so anything we do here happens "before create").
	app.OnRecordCreateRequest("posts").BindFunc(func(e *core.RecordRequestEvent) error {
		title := e.Record.GetString("title")

		// Reject creation when the title is empty or missing.
		if title == "" {
			// BadRequestError returns a 400 Bad Request ApiError carrying
			// the provided message, which gets serialized to the client.
			return e.BadRequestError("Title cannot be empty", nil)
		}

		// Programmatically generate the slug from the title.
		e.Record.Set("slug", slugify(title))

		// Continue the hook execution chain (proceed to the next handler).
		return e.Next()
	})

	if err := app.Start(); err != nil {
		log.Fatal(err)
	}
}