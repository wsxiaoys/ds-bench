package main

import (
	"log"
	"regexp"
	"strings"

	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/core"
)

func Slugify(str string) string {
	str = strings.ToLower(str)
	reg := regexp.MustCompile(`[^a-z0-9]+`)
	return strings.Trim(reg.ReplaceAllString(str, "-"), "-")
}

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
