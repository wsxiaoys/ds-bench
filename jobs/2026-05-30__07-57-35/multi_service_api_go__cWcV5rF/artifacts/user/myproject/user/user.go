package user

import "context"

type User struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

// Get returns a user by ID.
//encore:api public method=GET path=/user/:id
func Get(ctx context.Context, id string) (*User, error) {
	return &User{
		ID:   id,
		Name: "User " + id,
	}, nil
}
