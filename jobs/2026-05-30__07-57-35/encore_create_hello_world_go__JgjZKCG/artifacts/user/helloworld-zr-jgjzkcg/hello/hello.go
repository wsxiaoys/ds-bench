package hello

import (
	"context"
)

type Response struct {
	Message string `json:"Message"`
}

//encore:api public method=GET path=/hello/:name
func World(ctx context.Context, name string) (*Response, error) {
	return &Response{Message: "Hello, " + name + "!"}, nil
}
