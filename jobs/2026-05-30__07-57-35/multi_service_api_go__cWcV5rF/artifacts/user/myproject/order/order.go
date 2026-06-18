package order

import (
	"context"

	"myapp/user"
)

type Order struct {
	ID       string `json:"id"`
	UserID   string `json:"user_id"`
	UserName string `json:"user_name"`
}

// Get returns an order by ID and fetches user details.
//encore:api public method=GET path=/order/:id
func Get(ctx context.Context, id string) (*Order, error) {
	userID := "user-" + id
	userDetails, err := user.Get(ctx, userID)
	if err != nil {
		return nil, err
	}

	return &Order{
		ID:       id,
		UserID:   userDetails.ID,
		UserName: userDetails.Name,
	}, nil
}
