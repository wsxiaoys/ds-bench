package api

import "context"

// Response is a generic JSON response with a message field.
type Response struct {
	Message string `json:"message"`
}

// Hello returns a greeting for the given name.
//
//encore:api public method=GET path=/hello/:name
func Hello(ctx context.Context, name string) (*Response, error) {
	return &Response{Message: "Hello, " + name + "!"}, nil
}

// Ping returns a simple pong response.
//
//encore:api public method=GET path=/ping
func Ping(ctx context.Context) (*Response, error) {
	return &Response{Message: "pong"}, nil
}
