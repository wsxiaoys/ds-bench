package auth

import (
	"context"

	"encore.dev/beta/auth"
	"encore.dev/beta/errs"
)

// AuthData holds custom authentication data for the user.
type AuthData struct {
	Role string
}

// ValidateToken validates the incoming bearer token.
//
//encore:authhandler
func ValidateToken(ctx context.Context, token string) (auth.UID, *AuthData, error) {
	if token == "secret-token" {
		return "user-123", &AuthData{Role: "admin"}, nil
	}

	return "", nil, &errs.Error{
		Code:    errs.Unauthenticated,
		Message: "invalid token",
	}
}
