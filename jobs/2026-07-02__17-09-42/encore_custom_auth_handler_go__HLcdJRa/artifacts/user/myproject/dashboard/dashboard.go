package dashboard

import (
	"context"
	"fmt"

	"encore.dev/beta/auth"

	"myapp/auth"
)

// Response is the JSON response returned by the dashboard endpoint.
type Response struct {
	Message string `json:"message"`
}

// GetDashboard returns a protected dashboard message for the authenticated user.
//encore:api auth path=/dashboard method=GET
func GetDashboard(ctx context.Context) (*Response, error) {
	uid := auth.UserID()
	data := auth.Data[*auth.CustomAuthData]()
	return &Response{
		Message: fmt.Sprintf("Hello %s, you are an %s", uid, data.Role),
	}, nil
}