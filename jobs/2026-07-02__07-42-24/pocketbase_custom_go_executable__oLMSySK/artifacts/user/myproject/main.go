package main

import (
	"log"
	"strings"

	"myproject/core"
	"github.com/pocketbase/pocketbase"
	pbCore "github.com/pocketbase/pocketbase/core"
)

func main() {
	app := pocketbase.New()

	// Register OnRecordCreateRequest hook for the "posts" collection
	app.OnRecordCreateRequest("posts").BindFunc(func(e *pbCore.RecordRequestEvent) error {
		title := e.Record.GetString("title")
		if strings.TrimSpace(title) == "" {
			return e.BadRequestError("Title cannot be empty", nil)
		}

		e.Record.Set("slug", core.Slugify(title))

		return e.Next()
	})

	if err := app.Start(); err != nil {
		log.Fatal(err)
	}
}
