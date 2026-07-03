// Package auth implements the authentication handler for the application.
package auth

import (
	"context"

	"encore.dev/beta/auth"
	"encore.dev/beta/errs"
)

// AuthData is the custom authentication data returned by the auth handler.
type AuthData struct {
	Role string
}

// AuthHandler is the authentication handler.
//
// It validates the incoming token and returns the user's UID and custom auth data.
//
//encore:authhandler
func AuthHandler(ctx context.Context, token string) (auth.UID, *AuthData, error) {
	// Check if the token matches the expected secret token.
	if token == "secret-token" {
		// Return the user ID and custom auth data with the admin role.
		return auth.UID("user-123"), &AuthData{Role: "admin"}, nil
	}

	// If the token is invalid or missing, return an Unauthenticated error.
	return "", nil, &errs.Error{
		Code:    errs.Unauthenticated,
		Message: "invalid or missing token",
	}
}