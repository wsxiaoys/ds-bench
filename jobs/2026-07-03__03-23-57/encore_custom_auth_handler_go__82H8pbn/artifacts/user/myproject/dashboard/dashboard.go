package dashboard

import (
	"context"
	"fmt"

	"encore.dev/beta/auth"
	"encore.dev/beta/errs"
	myappauth "encore.app/auth"
)

type DashboardResponse struct {
	Message string `json:"message"`
}

// GetDashboard is a protected API endpoint.
//encore:api auth method=GET path=/dashboard
func GetDashboard(ctx context.Context) (*DashboardResponse, error) {
	uid, ok := auth.UserID()
	if !ok {
		return nil, &errs.Error{
			Code:    errs.Unauthenticated,
			Message: "unauthenticated",
		}
	}

	data, ok := auth.Data().(*myappauth.AuthData)
	if !ok || data == nil {
		return nil, &errs.Error{
			Code:    errs.Internal,
			Message: "missing custom auth data",
		}
	}

	msg := fmt.Sprintf("Hello %s, you are an %s", uid, data.Role)
	return &DashboardResponse{
		Message: msg,
	}, nil
}
