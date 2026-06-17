package order

import (
	"context"
	"myapp-ef92/user"
)

type Order struct {
	ID       string `json:"id"`
	UserID   string `json:"user_id"`
	UserName string `json:"user_name"`
}

// Get gets an order by ID.
//encore:api public path=/order/:id
func Get(ctx context.Context, id string) (*Order, error) {
	// Call the user service
	u, err := user.Get(ctx, "u123")
	if err != nil {
		return nil, err
	}
	return &Order{
		ID:       id,
		UserID:   u.ID,
		UserName: u.Name,
	}, nil
}
