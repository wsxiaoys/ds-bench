package user

import (
"context"
"fmt"
)

type User struct {
ID   string `json:"id"`
Name string `json:"name"`
}

//encore:api public path=/user/:id method=GET
func GetUser(ctx context.Context, id string) (*User, error) {
return &User{
ID:   id,
Name: fmt.Sprintf("User %s", id),
}, nil
}
