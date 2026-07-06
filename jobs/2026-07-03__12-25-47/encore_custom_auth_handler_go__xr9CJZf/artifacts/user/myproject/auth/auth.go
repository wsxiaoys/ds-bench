package auth

import (
"encore.dev/beta/auth"
"encore.dev/beta/errs"
"context"
)

//encore:authhandler
func AuthHandler(ctx context.Context, token string) (auth.UID, *AuthData, error) {
if token != "secret-token" {
return "", nil, &errs.Error{
Code:    errs.Unauthenticated,
Message: "invalid token",
}
}
return auth.UID("user-123"), &AuthData{Role: "admin"}, nil
}

type AuthData struct {
Role string `json:"role"`
}
