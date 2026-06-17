package auth

import (
	"context"
	"encore.dev/beta/auth"
	"encore.dev/beta/errs"
)

type Data struct {
	Role string
}

//encore:authhandler
func AuthHandler(ctx context.Context, token string) (auth.UID, *Data, error) {
	if token == "secret-token" {
		return "user-123", &Data{Role: "admin"}, nil
	}
	return "", nil, &errs.Error{
		Code:    errs.Unauthenticated,
		Message: "invalid token",
	}
}
