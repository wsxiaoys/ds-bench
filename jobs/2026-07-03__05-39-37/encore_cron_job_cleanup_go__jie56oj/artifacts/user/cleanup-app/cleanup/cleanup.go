// Package cleanup implements a service that stores records in a PostgreSQL
// database and periodically cleans up stale records older than 24 hours.
package cleanup

import (
	"context"
	"fmt"
	"time"

	"encore.dev/cron"
	"encore.dev/storage/sqldb"
)

// cleanupDB is the PostgreSQL database used by the cleanup service.
var cleanupDB = sqldb.NewDatabase("cleanup_db", sqldb.DatabaseConfig{
	Migrations: "./migrations",
})

// Record represents a single record stored in the database.
type Record struct {
	ID        string    `json:"id"`
	Data      string    `json:"data"`
	CreatedAt time.Time `json:"created_at"`
}

// CreateRecordRequest is the request body accepted by the POST /records endpoint.
type CreateRecordRequest struct {
	ID        string `json:"id"`
	Data      string `json:"data"`
	CreatedAt string `json:"created_at"` // RFC3339 formatted timestamp
}

// ListRecordsResponse is the response returned by the GET /records endpoint.
type ListRecordsResponse struct {
	Records []Record `json:"records"`
}

// CreateRecord inserts a new record into the database. The created_at field is
// provided in RFC3339 format so that historical records can be inserted for
// testing the cleanup logic.
//
//encore:api public method=POST path=/records
func CreateRecord(ctx context.Context, req *CreateRecordRequest) error {
	createdAt, err := time.Parse(time.RFC3339, req.CreatedAt)
	if err != nil {
		return fmt.Errorf("invalid created_at (expected RFC3339): %w", err)
	}
	_, err = cleanupDB.Exec(ctx, `
		INSERT INTO records (id, data, created_at)
		VALUES ($1, $2, $3)
	`, req.ID, req.Data, createdAt)
	if err != nil {
		return fmt.Errorf("insert record: %w", err)
	}
	return nil
}

// ListRecords returns every record currently stored in the database.
//
//encore:api public method=GET path=/records
func ListRecords(ctx context.Context) (*ListRecordsResponse, error) {
	rows, err := cleanupDB.Query(ctx, `
		SELECT id, data, created_at FROM records ORDER BY created_at
	`)
	if err != nil {
		return nil, fmt.Errorf("query records: %w", err)
	}
	defer rows.Close()

	records := []Record{}
	for rows.Next() {
		var r Record
		if err := rows.Scan(&r.ID, &r.Data, &r.CreatedAt); err != nil {
			return nil, fmt.Errorf("scan record: %w", err)
		}
		records = append(records, r)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate records: %w", err)
	}
	return &ListRecordsResponse{Records: records}, nil
}

// Cleanup deletes all records whose created_at timestamp is older than 24
// hours from the current time. It is exposed as a public endpoint so that it
// can be triggered manually for verification, and is also invoked on a
// schedule by the cron job defined below.
//
//encore:api public method=POST path=/cleanup
func Cleanup(ctx context.Context) error {
	_, err := cleanupDB.Exec(ctx, `
		DELETE FROM records WHERE created_at < NOW() - INTERVAL '24 hours'
	`)
	if err != nil {
		return fmt.Errorf("cleanup records: %w", err)
	}
	return nil
}

// cleanupJob runs the Cleanup endpoint every hour to remove stale records.
var _ = cron.NewJob("cleanup-job", cron.JobConfig{
	Title:    "Clean up stale records",
	Every:    1 * cron.Hour,
	Endpoint: Cleanup,
})