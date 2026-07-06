package auth

import (
	"context"
	"encore.dev/beta/auth"
	"encore.dev/beta/errs"
)

// AuthData defines the custom auth data.
type AuthData struct {
	Role string
}

// AuthHandler handles authentication.
//encore:authhandler
func AuthHandler(ctx context.Context, token string) (auth.UID, *AuthData, error) {
	if token == "secret-token" {
		return "user-123", &AuthData{Role: "admin"}, nil
	}
	return "", nil, &errs.Error{
		Code:    errs.Unauthenticated,
		Message: "invalid or missing token",
	}
}
