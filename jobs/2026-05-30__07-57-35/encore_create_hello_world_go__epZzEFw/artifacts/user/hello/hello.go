package hello

import (
	"context"
	"fmt"
)

//encore:api public method=GET path=/hello/:name
func World(ctx context.Context, name string) (*GreetingResponse, error) {
	return &GreetingResponse{Message: fmt.Sprintf("Hello, %s!", name)}, nil
}

type GreetingResponse struct {
	Message string
}