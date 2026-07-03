package order

import (
	"context"
	"fmt"

	"myapp/user"
)

// Order represents an order in the system.
type Order struct {
	ID       string `json:"id"`
	UserID   string `json:"user_id"`
	UserName string `json:"user_name"`
}

// GetOrder returns the order with the given ID. It also calls the
// user service to fetch the user details and include them in the response.
//
//encore:api public path=/order/:id method=GET
func GetOrder(ctx context.Context, id string) (*Order, error) {
	if id == "" {
		return nil, fmt.Errorf("order id is required")
	}

	// In a real application we'd look this up in a database. For this
	// demo we synthesize a deterministic order based on the id.
	// We use the first 4 chars of the order id as the user id for variety.
	userID := fmt.Sprintf("u-%s", id)

	// Make a service-to-service call to the user service. Encore handles
	// the networking: this is just a normal Go function call.
	u, err := user.GetUser(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("fetch user: %w", err)
	}

	return &Order{
		ID:       id,
		UserID:   u.ID,
		UserName: u.Name,
	}, nil
}