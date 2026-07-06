package main

import (
	"log"
	"math"
	"strings"

	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/core"

	_ "pbapp/migrations"
)

const wordsPerMinuteBatch = 200

// computeArticleMetrics derives the word_count and reading_time_minutes
// values from the submitted article "content". An empty or whitespace
// only content yields 0 words -> 0 minutes.
func computeArticleMetrics(content string) (int, int) {
	words := len(strings.Fields(content))
	if words == 0 {
		return 0, 0
	}
	return words, int(math.Ceil(float64(words) / wordsPerMinuteBatch))
}

// writeArticleMetrics overwrites word_count and reading_time_minutes on
// the supplied record with values derived from its current "content".
func writeArticleMetrics(record *core.Record) {
	words, minutes := computeArticleMetrics(record.GetString("content"))
	record.Set("word_count", words)
	record.Set("reading_time_minutes", minutes)
}

func main() {
	app := pocketbase.New()

	// Register event hooks so that the server always recomputes the
	// derived metrics from the submitted "content", ignoring anything the
	// client supplied for word_count / reading_time_minutes.
	app.OnRecordCreateRequest("articles").BindFunc(func(e *core.RecordRequestEvent) error {
		writeArticleMetrics(e.Record)
		return e.Next()
	})

	app.OnRecordUpdateRequest("articles").BindFunc(func(e *core.RecordRequestEvent) error {
		writeArticleMetrics(e.Record)
		return e.Next()
	})

	if err := app.Start(); err != nil {
		log.Fatal(err)
	}
}
