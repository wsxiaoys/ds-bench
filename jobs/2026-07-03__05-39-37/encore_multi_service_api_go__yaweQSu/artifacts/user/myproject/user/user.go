// Package user provides user-related APIs.
package user

import (
	"context"
)

// UserResponse is the response returned by the Get API.
type UserResponse struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

// Get returns the user with the given id.
//
//encore:api path=/user/:id
func Get(ctx context.Context, id string) (*UserResponse, error) {
	// In a real app this would query a database; here we use a static map.
	if u, ok := users[id]; ok {
		return u, nil
	}
	// Default fallback so any id returns a user.
	return &UserResponse{ID: id, Name: "User " + id}, nil
}

// users is a small static "database" of users.
var users = map[string]*UserResponse{
	"1": {ID: "1", Name: "Alice"},
	"2": {ID: "2", Name: "Bob"},
	"3": {ID: "3", Name: "Carol"},
}