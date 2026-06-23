package dashboard

import (
	"context"
	"fmt"

	"encore.dev/beta/auth"
	authpkg "encore.app/auth"
)

// DashboardResponse is the response returned by the Dashboard endpoint.
type DashboardResponse struct {
	Message string `json:"message"`
}

// Get returns a personalized dashboard message for the authenticated user.
//
//encore:api auth method=GET path=/dashboard
func Get(ctx context.Context) (*DashboardResponse, error) {
	uid, _ := auth.UserID()
	data := auth.Data().(*authpkg.AuthData)

	msg := fmt.Sprintf("Hello %s, you are an %s", string(uid), data.Role)
	return &DashboardResponse{Message: msg}, nil
}
