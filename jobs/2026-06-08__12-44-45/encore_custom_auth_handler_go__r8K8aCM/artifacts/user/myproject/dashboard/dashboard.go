package dashboard

import (
	"context"
	"fmt"

	"encore.dev/beta/auth"
	auth_pkg "encore.app/auth" // Import the auth package to access the Data struct
)

type DashboardResponse struct {
	Message string `json:"message"`
}

//encore:api auth method=GET path=/dashboard
func GetDashboard(ctx context.Context) (*DashboardResponse, error) {
	uid, _ := auth.UserID()
	data := auth.Data().(*auth_pkg.Data)

	return &DashboardResponse{
		Message: fmt.Sprintf("Hello %s, you are an %s", uid, data.Role),
	}, nil
}
