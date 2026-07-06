package core

import (
	"regexp"
	"strings"

	"github.com/pocketbase/pocketbase/core"
)

// Re-export RecordRequestEvent
type RecordRequestEvent = core.RecordRequestEvent

// Slugify generates a slug from a string.
func Slugify(s string) string {
	s = strings.ToLower(s)
	reg := regexp.MustCompile(`[^a-z0-9]+`)
	s = reg.ReplaceAllString(s, "-")
	s = strings.Trim(s, "-")
	return s
}
