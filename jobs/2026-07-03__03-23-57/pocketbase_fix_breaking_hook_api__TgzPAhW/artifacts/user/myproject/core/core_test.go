package core

import "testing"

func TestSlugify(t *testing.T) {
	tests := []struct {
		input    string
		expected string
	}{
		{"Hello World", "hello-world"},
		{"PocketBase v0.31.0", "pocketbase-v0-31-0"},
		{"  Some Space  ", "some-space"},
		{"Title with special chars!@#", "title-with-special-chars"},
		{"", ""},
	}

	for _, test := range tests {
		result := Slugify(test.input)
		if result != test.expected {
			t.Errorf("Slugify(%q) = %q; expected %q", test.input, result, test.expected)
		}
	}
}
