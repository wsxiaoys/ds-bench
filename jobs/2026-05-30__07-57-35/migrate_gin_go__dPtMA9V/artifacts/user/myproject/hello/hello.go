package hello

import (
	"context"
)

type HelloResponse struct {
	Message string `json:"message"`
}

type PingResponse struct {
	Message string `json:"message"`
}

//encore:api public path=/hello/:name
func Hello(ctx context.Context, name string) (*HelloResponse, error) {
	return &HelloResponse{Message: "Hello, " + name + "!"}, nil
}

//encore:api public path=/ping
func Ping(ctx context.Context) (*PingResponse, error) {
	return &PingResponse{Message: "pong"}, nil
}