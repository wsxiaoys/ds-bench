package main

import (
	"log"
	"strings"
	"unicode"

	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/core"
)

func slugify(s string) string {
	var b strings.Builder
	for _, r := range s {
		switch {
		case unicode.IsLetter(r) || unicode.IsDigit(r):
			b.WriteRune(unicode.ToLower(r))
		case unicode.IsSpace(r) || r == 0x2D || r == 0x5F:
			b.WriteRune(0x2D)
		}
	}
	return strings.Trim(b.String(), "-")
}

func main() {
	app := pocketbase.New()

	app.OnRecordCreateRequest("posts").BindFunc(func(e *core.RecordRequestEvent) error {
		title := e.Record.GetString("title")
		if title == "" {
			return e.BadRequestError("Title cannot be empty", nil)
		}
		e.Record.Set("slug", slugify(title))
		return e.Next()
	})

	if err := app.Start(); err != nil {
		log.Fatal(err)
	}
}
