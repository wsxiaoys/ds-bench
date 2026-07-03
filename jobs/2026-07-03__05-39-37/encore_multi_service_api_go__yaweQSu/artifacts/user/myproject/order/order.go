// Package order provides order-related APIs.
package order

import (
	"context"

	"myapp-mbx2/user"
)

// OrderResponse is the response returned by the Get API.
type OrderResponse struct {
	ID       string `json:"id"`
	UserID   string `json:"user_id"`
	UserName string `json:"user_name"`
}

// Get returns the order with the given id, including the user's details
// fetched via a service-to-service call to the user service.
//
//encore:api path=/order/:id
func Get(ctx context.Context, id string) (*OrderResponse, error) {
	// Look up the order in our static "database".
	o, ok := orders[id]
	if !ok {
		// Default fallback so any id returns an order.
		o = &order{ID: id, UserID: "1"}
	}

	// Service-to-service call to the user service.
	// Encore handles the networking transparently.
	u, err := user.Get(ctx, o.UserID)
	if err != nil {
		return nil, err
	}

	return &OrderResponse{
		ID:       o.ID,
		UserID:   u.ID,
		UserName: u.Name,
	}, nil
}

// order is the internal storage type.
type order struct {
	ID     string
	UserID string
}

// orders is a small static "database" of orders.
var orders = map[string]*order{
	"100": {ID: "100", UserID: "1"},
	"101": {ID: "101", UserID: "2"},
	"102": {ID: "102", UserID: "3"},
}