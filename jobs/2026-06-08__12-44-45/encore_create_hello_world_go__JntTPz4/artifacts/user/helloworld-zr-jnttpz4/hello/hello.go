package hello

import (
	"context"
	"fmt"
)

type WorldResponse struct {
	Message string
}

// World responds with a greeting.
//encore:api public method=GET path=/hello/:name
func World(ctx context.Context, name string) (*WorldResponse, error) {
	msg := fmt.Sprintf("Hello, %s!", name)
	return &WorldResponse{Message: msg}, nil
}
