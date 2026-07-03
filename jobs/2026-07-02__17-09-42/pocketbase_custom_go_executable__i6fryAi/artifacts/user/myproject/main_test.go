package main

import "testing"

func TestSlugify(t *testing.T) {
	tests := []struct {
		name string
		in   string
		want string
	}{
		{"empty", "", ""},
		{"whitespace only", "   ", ""},
		{"simple", "Hello World", "hello-world"},
		{"punctuation", "Hello, World!", "hello-world"},
		{"multiple spaces", "Hello   World", "hello-world"},
		{"camel case", "CamelCaseString", "camelcasestring"},
		{"trims edges", "  --hello--  ", "hello"},
		{"unicode letters", "Café Résumé", "café-résumé"},
		{"numbers preserved", "Top 10 Lists", "top-10-lists"},
		{"ampersand", "Go & PocketBase", "go-pocketbase"},
		{"underscore", "snake_case_name", "snake-case-name"},
		{"tabs and newlines", "a\tb\nc", "a-b-c"},
		{"dashes collapse", "a---b", "a-b"},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got := Slugify(tc.in)
			if got != tc.want {
				t.Errorf("Slugify(%q) = %q, want %q", tc.in, got, tc.want)
			}
		})
	}
}