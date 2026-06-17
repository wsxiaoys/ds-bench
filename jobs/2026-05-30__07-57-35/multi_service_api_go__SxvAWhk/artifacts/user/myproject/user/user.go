package user

import (
	"context"

	"encore.dev/beta/errs"
)

// User represents a user object.
type User struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

// In-memory user data.
var users = map[string]User{
	"1": {ID: "1", Name: "Alice"},
	"2": {ID: "2", Name: "Bob"},
	"3": {ID: "3", Name: "Charlie"},
}

//encore:api public method=GET path=/user/:id
func GetUser(ctx context.Context, id string) (*User, error) {
	if user, ok := users[id]; ok {
		return &user, nil
	}
	return nil, &errs.Error{
		Code:    errs.NotFound,
		Message: "user not found",
	}
}