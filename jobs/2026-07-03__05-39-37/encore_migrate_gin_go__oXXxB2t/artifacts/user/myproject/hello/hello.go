// Package hello implements the migrated Gin endpoints using Encore's
// declarative API approach.
package hello

import (
	"context"
	"fmt"
)

// MessageResponse is the JSON response returned by the hello service endpoints.
type MessageResponse struct {
	Message string `json:"message"`
}

// Hello returns a greeting for the given name.
//
//encore:api public path=/hello/:name
func Hello(ctx context.Context, name string) (*MessageResponse, error) {
	return &MessageResponse{Message: fmt.Sprintf("Hello, %s!", name)}, nil
}

// Ping returns a simple pong message.
//
//encore:api public path=/ping
func Ping(ctx context.Context) (*MessageResponse, error) {
	return &MessageResponse{Message: "pong"}, nil
}