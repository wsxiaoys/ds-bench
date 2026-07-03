package main

import (
	"log"
	"regexp"
	"strings"
	"unicode"

	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/core"
)

// slugifyRe matches any character that is not a unicode letter, digit, or hyphen.
var slugifyRe = regexp.MustCompile(`[^\p{L}\p{N}-]+`)

// multipleHyphenRe collapses repeated hyphens into a single hyphen.
var multipleHyphenRe = regexp.MustCompile(`-+`)

// Slugify converts an arbitrary string into a URL-safe slug.
//
// It lowercases the input, replaces every non-alphanumeric (unicode aware)
// run with a single hyphen, trims leading/trailing hyphens and collapses
// consecutive hyphens. The result is safe to use as a slug for the
// PocketBase "posts" collection.
//
//	Slugify("Hello World!")  // "hello-world"
//	Slugify("  Go & PocketBase  ") // "go-pocketbase"
func Slugify(str string) string {
	str = strings.TrimSpace(str)
	if str == "" {
		return ""
	}

	str = strings.ToLower(str)

	// Replace any run of non-letter/non-digit characters with a single hyphen.
	str = slugifyRe.ReplaceAllString(str, "-")

	// Collapse repeated hyphens.
	str = multipleHyphenRe.ReplaceAllString(str, "-")

	// Trim leading/trailing hyphens.
	str = strings.Trim(str, "-")

	// Strip any remaining whitespace that may have slipped through (e.g.
	// tabs that are not part of the unicode letter/number classes above).
	var b strings.Builder
	for _, r := range str {
		if unicode.IsSpace(r) {
			b.WriteByte('-')
			continue
		}
		b.WriteRune(r)
	}

	return strings.Trim(b.String(), "-")
}

func main() {
	app := pocketbase.New()

	// Register a record-create request hook for the "posts" collection.
	//
	// In PocketBase v0.31.0 the closest equivalent to the documented
	// "OnRecordBeforeCreateRequest" hook is the request-level
	// "OnRecordCreateRequest" hook, which fires before the record is
	// persisted and exposes the in-flight record via e.Record.
	app.OnRecordCreateRequest("posts").BindFunc(func(e *core.RecordRequestEvent) error {
		// Read the "title" field. An empty/missing title is rejected.
		title := strings.TrimSpace(e.Record.GetString("title"))
		if title == "" {
			return apis.NewBadRequestError("Title cannot be empty", nil)
		}

		// Programmatically generate the slug from the title.
		e.Record.Set("slug", Slugify(title))

		// Propagate execution to the next handler in the chain so the
		// record creation can proceed.
		return e.Next()
	})

	if err := app.Start(); err != nil {
		log.Fatal(err)
	}
}