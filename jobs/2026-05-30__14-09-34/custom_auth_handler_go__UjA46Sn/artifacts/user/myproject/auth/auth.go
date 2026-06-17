package auth

import (
	"context"

	encoreauth "encore.dev/beta/auth"
	"encore.dev/beta/errs"
)

type UserData struct {
	Role string
}

//encore:authhandler
func Authenticate(ctx context.Context, token string) (encoreauth.UID, *UserData, error) {
	if token != "secret-token" {
		return "", nil, errs.Unauthenticated("invalid token")
	}

	return encoreauth.UID("user-123"), &UserData{Role: "admin"}, nil
}
