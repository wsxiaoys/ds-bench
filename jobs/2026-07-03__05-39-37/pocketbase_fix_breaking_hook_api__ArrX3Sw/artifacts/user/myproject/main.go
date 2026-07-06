package main

import (
	"log"

	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/core"
)

func main() {
	app := pocketbase.New()

	app.OnRecordCreateRequest("posts").BindFunc(func(e *core.RecordRequestEvent) error {
		title := e.Record.GetString("title")
		if title == "" {
			return e.BadRequestError("Title cannot be empty", nil)
		}

		slug := core.Slugify(title)
		e.Record.Set("slug", slug)

		return e.Next()
	})

	if err := app.Start(); err != nil {
		log.Fatal(err)
	}
}