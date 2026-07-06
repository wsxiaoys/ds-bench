package dashboard

import (
"context"
encAuth "encore.dev/beta/auth"
"myapp/auth"
)

//encore:api auth method=GET path=/dashboard
func GetDashboard(ctx context.Context) (*DashboardResponse, error) {
uid, _ := encAuth.UserID()
data, _ := encAuth.Data().(*auth.AuthData)
return &DashboardResponse{
Message: "Hello " + string(uid) + ", you are an " + data.Role,
}, nil
}

type DashboardResponse struct {
Message string `json:"message"`
}
