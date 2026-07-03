package core

import (
	"regexp"
	"strings"
)

var slugRegex = regexp.MustCompile(`[^a-z0-9]+`)

// Slugify converts a string into a slug containing only lowercase letters, digits, and hyphens.
func Slugify(s string) string {
	s = strings.ToLower(s)
	s = slugRegex.ReplaceAllString(s, "-")
	s = strings.Trim(s, "-")
	return s
}
