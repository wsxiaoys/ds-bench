package hello

import "context"

// Response is the JSON response for the World endpoint.
type Response struct {
	Message string
}

// World responds with a greeting for the given name.
//
//encore:api public method=GET path=/hello/:name
func World(ctx context.Context, name string) (*Response, error) {
	return &Response{Message: "Hello, " + name + "!"}, nil
}
