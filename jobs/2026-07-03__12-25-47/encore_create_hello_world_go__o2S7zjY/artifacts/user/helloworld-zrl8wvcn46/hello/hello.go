package hello

import (
"context"
)

// World responds with a greeting.
//encore:api public path=/hello/:name method=GET
func World(ctx context.Context, name string) (*WorldResponse, error) {
msg := "Hello, " + name + "!"
return &WorldResponse{Message: msg}, nil
}

type WorldResponse struct {
Message string `json:"message"`
}

