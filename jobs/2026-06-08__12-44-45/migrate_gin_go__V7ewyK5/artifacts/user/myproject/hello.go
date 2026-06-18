package myproject

import (
	"context"
	"fmt"
)

type HelloResponse struct {
	Message string `json:"message"`
}

//encore:api public path=/hello/:name
func Hello(ctx context.Context, name string) (*HelloResponse, error) {
	msg := fmt.Sprintf("Hello, %s!", name)
	return &HelloResponse{Message: msg}, nil
}

//encore:api public path=/ping
func Ping(ctx context.Context) (*HelloResponse, error) {
	return &HelloResponse{Message: "pong"}, nil
}
