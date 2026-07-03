package main

import (
	"log"
	"math"
	"strings"

	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/core"

	_ "pbapp/migrations"
)

func main() {
	app := pocketbase.New()

	// Register PocketBase event hooks on the "articles" collection so that
	// on every record create and record update REST request the server
	// automatically computes the word_count and reading_time_minutes fields.
	app.OnRecordCreateRequest("articles").BindFunc(func(e *core.RecordRequestEvent) error {
		if e.Record != nil {
			content := e.Record.GetString("content")
			wordCount, readingTime := computeWordCountAndReadingTime(content)
			e.Record.Set("word_count", wordCount)
			e.Record.Set("reading_time_minutes", readingTime)
		}
		return e.Next()
	})

	app.OnRecordUpdateRequest("articles").BindFunc(func(e *core.RecordRequestEvent) error {
		if e.Record != nil {
			content := e.Record.GetString("content")
			wordCount, readingTime := computeWordCountAndReadingTime(content)
			e.Record.Set("word_count", wordCount)
			e.Record.Set("reading_time_minutes", readingTime)
		}
		return e.Next()
	})

	if err := app.Start(); err != nil {
		log.Fatal(err)
	}
}

func computeWordCountAndReadingTime(content string) (int, int) {
	words := strings.Fields(content)
	wordCount := len(words)
	if wordCount == 0 {
		return 0, 0
	}
	readingTime := int(math.Ceil(float64(wordCount) / 200.0))
	return wordCount, readingTime
}
