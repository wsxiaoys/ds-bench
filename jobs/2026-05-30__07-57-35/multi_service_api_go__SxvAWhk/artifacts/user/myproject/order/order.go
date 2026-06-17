package order

import (
	"context"

	"encore.dev/beta/errs"

	"myproject/user"
)

// Order represents an order object with user details.
type Order struct {
	ID       string `json:"id"`
	UserID   string `json:"user_id"`
	UserName string `json:"user_name"`
}

// In-memory order data.
var orders = map[string]struct {
	ID     string
	UserID string
}{
	"1": {ID: "1", UserID: "1"},
	"2": {ID: "2", UserID: "2"},
	"3": {ID: "3", UserID: "3"},
}

//encore:api public method=GET path=/order/:id
func GetOrder(ctx context.Context, id string) (*Order, error) {
	orderData, ok := orders[id]
	if !ok {
		return nil, &errs.Error{
			Code:    errs.NotFound,
			Message: "order not found",
		}
	}

	// Service-to-service call to user service
	userInfo, err := user.GetUser(ctx, orderData.UserID)
	if err != nil {
		return nil, &errs.Error{
			Code:    errs.Internal,
			Message: "failed to fetch user",
		}
	}

	return &Order{
		ID:       orderData.ID,
		UserID:   userInfo.ID,
		UserName: userInfo.Name,
	}, nil
}