package cleanup

import (
    "context"
    "time"
)

//encore:api public method=POST path=/cleanup
func Cleanup(ctx context.Context) error {
    cutoff := time.Now().Add(-24 * time.Hour)
    _, err := db.Exec(ctx, `
        DELETE FROM records
        WHERE created_at < $1
    `, cutoff)
    return err
}
