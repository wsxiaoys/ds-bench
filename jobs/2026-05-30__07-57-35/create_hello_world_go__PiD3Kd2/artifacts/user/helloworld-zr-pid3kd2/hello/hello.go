package hello

import (
	"context"
)

type WorldResponse struct {
	Message string
}

//encore:api public method=GET path=/hello/:name
func World(ctx context.Context, name string) (*WorldResponse, error) {
	return &WorldResponse{Message: "Hello, " + name + "!"}, nil
}
