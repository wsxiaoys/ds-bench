package cleanup

import (
	"context"
	"time"

	"encore.dev/cron"
)

type Record struct {
	ID        string    `json:"id"`
	Data      string    `json:"data"`
	CreatedAt time.Time `json:"created_at"`
}

type InsertParams struct {
	ID        string    `json:"id"`
	Data      string    `json:"data"`
	CreatedAt time.Time `json:"created_at"`
}

// Insert inserts a new record.
//encore:api public method=POST path=/records
func Insert(ctx context.Context, params *InsertParams) error {
	_, err := db.Exec(ctx, `
		INSERT INTO records (id, data, created_at)
		VALUES ($1, $2, $3)
	`, params.ID, params.Data, params.CreatedAt)
	return err
}

type ListResponse struct {
	Records []Record `json:"records"`
}

// List returns all records.
//encore:api public method=GET path=/records
func List(ctx context.Context) (*ListResponse, error) {
	rows, err := db.Query(ctx, `
		SELECT id, data, created_at
		FROM records
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var records []Record
	for rows.Next() {
		var r Record
		if err := rows.Scan(&r.ID, &r.Data, &r.CreatedAt); err != nil {
			return nil, err
		}
		records = append(records, r)
	}
	return &ListResponse{Records: records}, nil
}

// Cleanup deletes records older than 24 hours.
//encore:api public method=POST path=/cleanup
func Cleanup(ctx context.Context) error {
	_, err := db.Exec(ctx, `
		DELETE FROM records
		WHERE created_at < NOW() - INTERVAL '24 hours'
	`)
	return err
}

// Define the Cron Job
var _ = cron.NewJob("cleanup-stale-records", cron.JobConfig{
	Title:    "Cleanup stale records",
	Endpoint: Cleanup,
	Every:    1 * cron.Hour,
})
// comment
