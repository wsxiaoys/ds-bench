package dashboard

import (
	"context"
	"fmt"
	"encore.dev/beta/auth"
	authpkg "encore.app/auth"
)

type DashboardResponse struct {
	Message string `json:"message"`
}

//encore:api auth method=GET path=/dashboard
func GetDashboard(ctx context.Context) (*DashboardResponse, error) {
	uid, _ := auth.UserID()
	data, _ := auth.Data().(*authpkg.Data)
	return &DashboardResponse{
		Message: fmt.Sprintf("Hello %s, you are an %s", uid, data.Role),
	}, nil
}
