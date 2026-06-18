package auth

import (
	"context"

	"encore.dev/beta/auth"
	"encore.dev/beta/errs"
)

type CustomData struct {
	Role string
}

//encore:authhandler
func AuthHandler(ctx context.Context, token string) (auth.UID, *CustomData, error) {
	if token == "secret-token" {
		return "user-123", &CustomData{Role: "admin"}, nil
	}
	return "", nil, &errs.Error{Code: errs.Unauthenticated, Message: "invalid or missing token"}
}