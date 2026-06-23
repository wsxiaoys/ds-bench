package dashboard

import (
	"context"
	"fmt"

	authpkg "myproject/auth"

	encoreauth "encore.dev/beta/auth"
)

type Response struct {
	Message string `json:"message"`
}

//encore:api auth method=GET path=/dashboard
func Dashboard(ctx context.Context) (*Response, error) {
	userID := encoreauth.UserID()
	data, _ := encoreauth.Data().(*authpkg.UserData)

	return &Response{
		Message: fmt.Sprintf("Hello %s, you are an %s", userID, data.Role),
	}, nil
}
