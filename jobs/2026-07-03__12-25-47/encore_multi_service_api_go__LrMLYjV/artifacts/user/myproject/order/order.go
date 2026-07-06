package order

import (
"context"

"myapp/user"
)

type Order struct {
ID       string `json:"id"`
UserID   string `json:"user_id"`
UserName string `json:"user_name"`
}

//encore:api public path=/order/:id method=GET
func GetOrder(ctx context.Context, id string) (*Order, error) {
u, err := user.GetUser(ctx, id)
if err != nil {
return nil, err
}
return &Order{
ID:       id,
UserID:   u.ID,
UserName: u.Name,
}, nil
}
