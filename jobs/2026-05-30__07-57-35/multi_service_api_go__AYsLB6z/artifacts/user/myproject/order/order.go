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

//encore:api public path=/order/:id
func GetOrder(ctx context.Context, id string) (*Order, error) {
	// Call the user service
	u, err := user.GetUser(ctx, "user-123")
	if err != nil {
		return nil, err
	}

	return &Order{
		ID:       id,
		UserID:   u.ID,
		UserName: u.Name,
	}, nil
}
