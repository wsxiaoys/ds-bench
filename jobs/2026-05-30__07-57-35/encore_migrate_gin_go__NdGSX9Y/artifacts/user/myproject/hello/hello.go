package hello

import "context"

type Message struct {
	Message string `json:"message"`
}

//encore:api public path=/hello/:name
func Hello(ctx context.Context, name string) (*Message, error) {
	return &Message{Message: "Hello, " + name + "!"}, nil
}

//encore:api public path=/ping
func Ping(ctx context.Context) (*Message, error) {
	return &Message{Message: "pong"}, nil
}
