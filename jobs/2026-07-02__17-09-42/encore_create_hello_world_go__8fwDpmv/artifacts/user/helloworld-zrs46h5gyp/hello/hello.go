package hello

import (
	"context"
	"fmt"
)

// WorldResponse is the JSON response returned by the World endpoint.
type WorldResponse struct {
	Message string `json:"message"`
}

// World returns a friendly greeting for the provided name.
//
//encore:api public path=/hello/:name method=GET
func World(ctx context.Context, name string) (*WorldResponse, error) {
	msg := fmt.Sprintf("Hello, %s!", name)
	return &WorldResponse{Message: msg}, nil
}