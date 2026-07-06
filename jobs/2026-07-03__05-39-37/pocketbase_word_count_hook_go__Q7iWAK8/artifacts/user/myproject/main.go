package main

import (
	"log"
	"math"
	"strings"

	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/core"
	_ "pbapp/migrations"
)

// computeArticleStats derives the word count and reading time (in minutes)
// from the provided content string.
//
//   - word_count is the number of whitespace-separated words.
//   - reading_time_minutes is ceil(word_count / 200); 0 words -> 0 minutes.
func computeArticleStats(content string) (wordCount int, readingTimeMinutes int) {
	wordCount = len(strings.Fields(content))
	if wordCount == 0 {
		readingTimeMinutes = 0
		return
	}
	readingTimeMinutes = int(math.Ceil(float64(wordCount) / 200.0))
	return
}

func main() {
	app := pocketbase.New()

	// Register a shared hook handler for both create and update REST requests
	// on the "articles" collection. The handler recomputes word_count and
	// reading_time_minutes from the submitted "content" field, overwriting any
	// client-supplied values, then calls e.Next() so the record is persisted.
	registerArticleHooks := func(e *core.RecordRequestEvent) error {
		content := e.Record.GetString("content")
		wordCount, readingTime := computeArticleStats(content)

		e.Record.Set("word_count", wordCount)
		e.Record.Set("reading_time_minutes", readingTime)

		return e.Next()
	}

	app.OnRecordCreateRequest("articles").BindFunc(registerArticleHooks)
	app.OnRecordUpdateRequest("articles").BindFunc(registerArticleHooks)

	if err := app.Start(); err != nil {
		log.Fatal(err)
	}
}