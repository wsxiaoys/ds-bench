package cleanup

import (
	"context"
	"time"

	"encore.dev/cron"
)

// CleanupResponse is the response body for POST /cleanup.
type CleanupResponse struct {
	DeletedCount int64 `json:"deleted_count"`
}

// Cleanup deletes records whose created_at is older than 24 hours.
// It is exposed as a public API so it can be invoked manually for
// verification, and it is also wired up to a Cron Job below.
//
//encore:api public method=POST path=/cleanup
func Cleanup(ctx context.Context) (*CleanupResponse, error) {
	cutoff := time.Now().Add(-24 * time.Hour)

	result, err := cleanupdb.Exec(ctx, `
		DELETE FROM records
		WHERE created_at < $1
	`, cutoff)
	if err != nil {
		return nil, err
	}

	return &CleanupResponse{DeletedCount: result.RowsAffected()}, nil
}

// CleanupCron runs every hour to remove stale records.
var _ = cron.NewJob("cleanup-old-records", cron.JobConfig{
	Title:    "Cleanup old records",
	Every:    1 * cron.Hour,
	Endpoint: Cleanup,
})