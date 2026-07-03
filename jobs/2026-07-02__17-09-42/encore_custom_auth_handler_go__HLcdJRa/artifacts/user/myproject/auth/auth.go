package auth

import (
	"context"

	"encore.dev/beta/auth"
	"encore.dev/beta/errs"
)

// CustomAuthData represents the custom authentication data attached to a user.
type CustomAuthData struct {
	Role string
}

// AuthHandler is a custom auth handler that validates an incoming token.
// If the token equals "secret-token", it returns the user ID "user-123"
// and custom auth data containing Role: "admin". Otherwise, it returns
// an Unauthenticated error.
//encore:authhandler
func AuthHandler(ctx context.Context, token string) (auth.UID, *CustomAuthData, error) {
	if token == "secret-token" {
		return "user-123", &CustomAuthData{Role: "admin"}, nil
	}
	return "", nil, &errs.Error{
		Code:    errs.Unauthenticated,
		Message: "invalid or missing token",
	}
}