package cleanup

import (
	"context"
	"time"

	"encore.dev/cron"
	"encore.dev/storage/sqldb"
)

// Define the PostgreSQL database for this service.
var db = sqldb.NewDatabase("cleanup_db", sqldb.DatabaseConfig{
	Migrations: "./migrations",
})

// Define a cron job that runs every hour to clean up stale records.
// It calls the POST /cleanup endpoint.
var _ = cron.NewJob("cleanup-job", cron.JobConfig{
	Title:    "Clean up stale records",
	Every:    1 * cron.Hour,
	Endpoint: Cleanup,
})

// Record represents a single record in the database.
type Record struct {
	ID        string    `json:"id"`
	Data      string    `json:"data"`
	CreatedAt time.Time `json:"created_at"`
}

// InsertRequest is the request body for the POST /records endpoint.
type InsertRequest struct {
	ID        string    `json:"id"`
	Data      string    `json:"data"`
	CreatedAt time.Time `json:"created_at"`
}

// InsertResponse is the response for the POST /records endpoint.
type InsertResponse struct {
	Record Record `json:"record"`
}

// ListResponse is the response for the GET /records endpoint.
type ListResponse struct {
	Records []Record `json:"records"`
}

// CleanupResponse is the response for the POST /cleanup endpoint.
type CleanupResponse struct {
	Deleted int64 `json:"deleted"`
}

// InsertRecord inserts a new record into the database.
//
//encore:api public method=POST path=/records
func InsertRecord(ctx context.Context, req *InsertRequest) (*InsertResponse, error) {
	_, err := db.Exec(ctx,
		"INSERT INTO records (id, data, created_at) VALUES ($1, $2, $3)",
		req.ID, req.Data, req.CreatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &InsertResponse{
		Record: Record{
			ID:        req.ID,
			Data:      req.Data,
			CreatedAt: req.CreatedAt,
		},
	}, nil
}

// ListRecords returns all records from the database.
//
//encore:api public method=GET path=/records
func ListRecords(ctx context.Context) (*ListResponse, error) {
	rows, err := db.Query(ctx, "SELECT id, data, created_at FROM records ORDER BY created_at DESC")
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
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if records == nil {
		records = []Record{}
	}
	return &ListResponse{Records: records}, nil
}

// Cleanup deletes records older than 24 hours from the database.
// This endpoint is called by the cron job and can also be triggered manually.
//
//encore:api public method=POST path=/cleanup
func Cleanup(ctx context.Context) (*CleanupResponse, error) {
	cutoff := time.Now().Add(-24 * time.Hour)
	tag, err := db.Exec(ctx,
		"DELETE FROM records WHERE created_at < $1",
		cutoff,
	)
	if err != nil {
		return nil, err
	}
	return &CleanupResponse{Deleted: tag.RowsAffected()}, nil
}
