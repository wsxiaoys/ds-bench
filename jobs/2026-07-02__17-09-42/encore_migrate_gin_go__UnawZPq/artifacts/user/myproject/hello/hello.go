package hello

import (
	"context"
	"fmt"
)

// MessageResponse is the response shape for both endpoints.
type MessageResponse struct {
	Message string `json:"message"`
}

// GetHello returns a greeting for the given name.
//
//encore:api public path=/hello/:name method=GET
func GetHello(ctx context.Context, name string) (*MessageResponse, error) {
	return &MessageResponse{
		Message: fmt.Sprintf("Hello, %s!", name),
	}, nil
}

// GetPing returns a simple pong response.
//
//encore:api public path=/ping method=GET
func GetPing(ctx context.Context) (*MessageResponse, error) {
	return &MessageResponse{
		Message: "pong",
	}, nil
}
