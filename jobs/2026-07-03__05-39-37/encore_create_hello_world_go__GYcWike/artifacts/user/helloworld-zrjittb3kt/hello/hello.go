// Package hello implements a simple Hello World API.
package hello

import (
	"context"
)

// World responds with a greeting for the given name.
//
//encore:api public path=/hello/:name
func World(ctx context.Context, name string) (*GreetingResponse, error) {
	return &GreetingResponse{Message: "Hello, " + name + "!"}, nil
}

// GreetingResponse is the response from the World endpoint.
type GreetingResponse struct {
	Message string `json:"message"`
}