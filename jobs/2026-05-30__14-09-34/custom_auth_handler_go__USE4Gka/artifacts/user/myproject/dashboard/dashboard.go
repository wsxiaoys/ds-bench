package dashboard

import (
	"context"
	"fmt"

	"encore.dev/beta/auth"

	myauth "encore.app/auth"
)

type Response struct {
	Message string `json:"message"`
}

//encore:api auth method=GET path=/dashboard
func Get(ctx context.Context) (*Response, error) {
	uid, _ := auth.UserID()
	data := auth.Data().(*myauth.CustomData)
	return &Response{
		Message: fmt.Sprintf("Hello %s, you are an %s", uid, data.Role),
	}, nil
}