// Service user provides user management functionality.
package user

import (
	"context"

	"encore.dev/beta/errs"
)

// GetUserResponse is the response type for the GetUser endpoint.
type GetUserResponse struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

// users is a simple in-memory store of users.
var users = map[string]string{
	"1": "Alice",
	"2": "Bob",
	"3": "Charlie",
}

// GetUser retrieves a user by ID.
//
//encore:api public method=GET path=/user/:id
func GetUser(ctx context.Context, id string) (*GetUserResponse, error) {
	name, ok := users[id]
	if !ok {
		return nil, &errs.Error{
			Code:    errs.NotFound,
			Message: "user not found",
		}
	}
	return &GetUserResponse{
		ID:   id,
		Name: name,
	}, nil
}
