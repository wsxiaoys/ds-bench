package user

import (
	"context"
	"fmt"
)

// User represents a user in the system.
type User struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

// GetUser returns the user with the given ID.
//
//encore:api public path=/user/:id method=GET
func GetUser(ctx context.Context, id string) (*User, error) {
	if id == "" {
		return nil, fmt.Errorf("user id is required")
	}
	return &User{
		ID:   id,
		Name: fmt.Sprintf("User %s", id),
	}, nil
}