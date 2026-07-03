package order

import (
	"context"

	"encore.app/user"
)

type Order struct {
	ID       string `json:"id"`
	UserID   string `json:"user_id"`
	UserName string `json:"user_name"`
}

//encore:api public method=GET path=/order/:id
func GetOrder(ctx context.Context, id string) (*Order, error) {
	userId := "usr_" + id

	usr, err := user.GetUser(ctx, userId)
	if err != nil {
		return nil, err
	}

	return &Order{
		ID:       id,
		UserID:   usr.ID,
		UserName: usr.Name,
	}, nil
}
