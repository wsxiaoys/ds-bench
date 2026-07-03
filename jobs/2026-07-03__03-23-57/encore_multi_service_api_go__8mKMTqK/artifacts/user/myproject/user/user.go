package user

import "context"

type User struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

//encore:api public method=GET path=/user/:id
func GetUser(ctx context.Context, id string) (*User, error) {
	return &User{
		ID:   id,
		Name: "User " + id,
	}, nil
}
