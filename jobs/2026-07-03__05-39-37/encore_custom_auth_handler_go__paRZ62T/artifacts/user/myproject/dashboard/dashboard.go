// Package dashboard provides a protected API endpoint that requires authentication.
package dashboard

import (
	"context"

	"encore.dev/beta/auth"

	customauth "custom-auth-app/auth"
)

// Response is the JSON response returned by the dashboard endpoint.
type Response struct {
	Message string `json:"message"`
}

// GetDashboard is a protected API endpoint that requires authentication.
//
// It reads the authenticated user's ID and custom auth data from the context
// and returns a greeting message.
//
//encore:api auth method=GET path=/dashboard
func GetDashboard(ctx context.Context) (*Response, error) {
	// Get the authenticated user's ID from the context.
	uid, _ := auth.UserID()

	// Get the custom auth data from the context and cast it to our custom type.
	data, ok := auth.Data().(*customauth.AuthData)

	// Build the greeting message using the user's ID and role.
	role := ""
	if ok {
		role = data.Role
	}

	return &Response{
		Message: "Hello " + string(uid) + ", you are an " + role,
	}, nil
}