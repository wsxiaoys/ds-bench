// Package cleanup provides a service for managing records and periodically
// cleaning up stale records older than 24 hours.
package cleanup

import (
	"context"
	"time"

	"encore.dev/cron"
	"encore.dev/storage/sqldb"
)

// DB is the cleanup database, backed by PostgreSQL.
var DB = sqldb.NewDatabase("cleanup_db", sqldb.DatabaseConfig{
	Migrations: "./migrations",
})

// Record represents a single record stored in the database.
type Record struct {
	ID        string `json:"id"`
	Data      string `json:"data"`
	CreatedAt string `json:"created_at"`
}

// CreateRecordRequest is the request body for the POST /records endpoint.
// CreatedAt must be provided in RFC3339 format to allow inserting historical
// records for testing the cleanup logic.
type CreateRecordRequest struct {
	ID        string `json:"id"`
	Data      string `json:"data"`
	CreatedAt string `json:"created_at"`
}

// ListRecordsResponse is the response body for the GET /records endpoint.
type ListRecordsResponse struct {
	Records []Record `json:"records"`
}

// CleanupResponse is the response body for the POST /cleanup endpoint.
type CleanupResponse struct {
	DeletedCount int `json:"deleted_count"`
}

// CreateRecord inserts a new record into the database.
//
//encore:api public method=POST path=/records
func CreateRecord(ctx context.Context, req CreateRecordRequest) (*Record, error) {
	// Validate the created_at timestamp is in RFC3339 format.
	parsed, err := time.Parse(time.RFC3339, req.CreatedAt)
	if err != nil {
		return nil, err
	}

	_, err = DB.Exec(ctx, `
		INSERT INTO records (id, data, created_at)
		VALUES ($1, $2, $3)
	`, req.ID, req.Data, parsed)
	if err != nil {
		return nil, err
	}

	return &Record{
		ID:        req.ID,
		Data:      req.Data,
		CreatedAt: req.CreatedAt,
	}, nil
}

// ListRecords returns all records currently stored in the database.
//
//encore:api public method=GET path=/records
func ListRecords(ctx context.Context) (*ListRecordsResponse, error) {
	rows, err := DB.Query(ctx, `
		SELECT id, data, created_at FROM records ORDER BY created_at
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	records := []Record{}
	for rows.Next() {
		var r Record
		var createdAt time.Time
		if err := rows.Scan(&r.ID, &r.Data, &createdAt); err != nil {
			return nil, err
		}
		r.CreatedAt = createdAt.Format(time.RFC3339)
		records = append(records, r)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return &ListRecordsResponse{Records: records}, nil
}

// Cleanup deletes all records older than 24 hours from the current time.
// It is exposed as a public endpoint so it can be manually triggered for
// verification, and is also called REDACTEDmatically by the cron job below.
//
//encore:api public method=POST path=/cleanup
func Cleanup(ctx context.Context) (*CleanupResponse, error) {
	result, err := DB.Exec(ctx, `
		DELETE FROM records
		WHERE created_at < NOW() - INTERVAL '24 hours'
	`)
	if err != nil {
		return nil, err
	}

	return &CleanupResponse{
		DeletedCount: int(result.RowsAffected()),
	}, nil
}

// CleanupJob is an Encore cron job that runs every hour to clean up stale
// records by calling the Cleanup endpoint.
var _ = cron.NewJob("cleanup-job", cron.JobConfig{
	Title:    "Clean up stale records older than 24 hours",
	Every:    1 * cron.Hour,
	Endpoint: Cleanup,
})