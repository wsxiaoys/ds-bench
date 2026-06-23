// Service order provides order management functionality.
package order

import (
	"context"

	"encore.app/user"
	"encore.dev/beta/errs"
)

// GetOrderResponse is the response type for the GetOrder endpoint.
type GetOrderResponse struct {
	ID       string `json:"id"`
	UserID   string `json:"user_id"`
	UserName string `json:"user_name"`
}

// orders is a simple in-memory store mapping order IDs to user IDs.
var orders = map[string]string{
	"101": "1",
	"102": "2",
	"103": "3",
}

// GetOrder retrieves an order by ID, including the associated user details.
//
//encore:api public method=GET path=/order/:id
func GetOrder(ctx context.Context, id string) (*GetOrderResponse, error) {
	userID, ok := orders[id]
	if !ok {
		return nil, &errs.Error{
			Code:    errs.NotFound,
			Message: "order not found",
		}
	}

	// Service-to-service call: Encore handles the networking transparently.
	userResp, err := user.GetUser(ctx, userID)
	if err != nil {
		return nil, err
	}

	return &GetOrderResponse{
		ID:       id,
		UserID:   userID,
		UserName: userResp.Name,
	}, nil
}
