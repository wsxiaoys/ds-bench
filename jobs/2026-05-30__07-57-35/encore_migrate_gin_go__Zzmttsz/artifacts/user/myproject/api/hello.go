package api

import (
	"context"
	"fmt"
)

type HelloResponse struct {
	Message string `json:"message"`
}

//encore:api public path=/hello/:name
func Hello(ctx context.Context, name string) (*HelloResponse, error) {
	return &HelloResponse{Message: fmt.Sprintf("Hello, %s!", name)}, nil
}

//encore:api public path=/ping
func Ping(ctx context.Context) (*HelloResponse, error) {
	return &HelloResponse{Message: "pong"}, nil
}
