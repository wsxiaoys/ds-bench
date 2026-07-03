package hello

import (
	"context"
)

type Response struct {
	Message string `json:"message"`
}

// Hello returns a greeting message.
//encore:api public method=GET path=/hello/:name
func Hello(ctx context.Context, name string) (*Response, error) {
	return &Response{Message: "Hello, " + name + "!"}, nil
}

// Ping returns pong.
//encore:api public method=GET path=/ping
func Ping(ctx context.Context) (*Response, error) {
	return &Response{Message: "pong"}, nil
}
