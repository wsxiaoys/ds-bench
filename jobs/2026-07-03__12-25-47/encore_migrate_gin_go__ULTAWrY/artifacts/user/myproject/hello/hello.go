package hello

import (
	"context"
	"fmt"
)

//encore:api public path=/hello/:name method=GET
func Hello(ctx context.Context, name string) (*Response, error) {
	msg := fmt.Sprintf("Hello, %s!", name)
	return &Response{Message: msg}, nil
}

//encore:api public path=/ping method=GET
func Ping(ctx context.Context) (*Response, error) {
	return &Response{Message: "pong"}, nil
}

type Response struct {
	Message string `json:"message"`
}
