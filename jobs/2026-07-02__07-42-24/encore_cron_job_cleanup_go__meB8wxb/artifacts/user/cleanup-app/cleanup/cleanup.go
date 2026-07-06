package cleanup

import (
	"context"
	"time"

	"encore.dev/cron"
	"encore.dev/storage/sqldb"
)

// Define the database using sqldb.NewDatabase.
// The migrations directory is relative to this file's directory.
var db = sqldb.NewDatabase("cleanup_db", sqldb.DatabaseConfig{
	Migrations: "./migrations",
})

// Record defines the structure of a record in the database.
type Record struct {
	ID        string `json:"id"`
	Data      string `json:"data"`
	CreatedAt string `json:"created_at"`
}

// CreateRecordParams defines the input for creating a record.
type CreateRecordParams struct {
	ID        string `json:"id"`
	Data      string `json:"data"`
	CreatedAt string `json:"created_at"` // RFC3339 format
}

// CreateRecordResponse defines the output for creating a record.
type CreateRecordResponse struct {
	ID        string `json:"id"`
	Data      string `json:"data"`
	CreatedAt string `json:"created_at"`
}

// ListRecordsResponse defines the output for listing records.
type ListRecordsResponse struct {
	Records []Record `json:"records"`
}

// CleanupResponse defines the output of the cleanup endpoint.
type CleanupResponse struct {
	DeletedCount int64 `json:"deleted_count"`
}

// CreateRecord inserts a new record or updates it if the ID already exists.
//encore:api public path=/records method=POST
func CreateRecord(ctx context.Context, params *CreateRecordParams) (*CreateRecordResponse, error) {
	createdAtTime, err := time.Parse(time.RFC3339, params.CreatedAt)
	if err != nil {
		return nil, err
	}

	_, err = db.Exec(ctx, "INSERT INTO records (id, data, created_at) VALUES ($1, $2, $3) ON CONFLICT (id) DO UPDATE SET data = $2, created_at = $3", params.ID, params.Data, createdAtTime)
	if err != nil {
		return nil, err
	}

	return &CreateRecordResponse{
		ID:        params.ID,
		Data:      params.Data,
		CreatedAt: params.CreatedAt,
	}, nil
}

// ListRecords returns all records from the database.
//encore:api public path=/records method=GET
func ListRecords(ctx context.Context) (*ListRecordsResponse, error) {
	rows, err := db.Query(ctx, "SELECT id, data, created_at FROM records ORDER BY created_at DESC")
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

// Cleanup deletes records older than 24 hours.
//encore:api public path=/cleanup method=POST
func Cleanup(ctx context.Context) (*CleanupResponse, error) {
	cutoff := time.Now().Add(-24 * time.Hour)
	res, err := db.Exec(ctx, "DELETE FROM records WHERE created_at < $1", cutoff)
	if err != nil {
		return nil, err
	}

	rowsAffected := res.RowsAffected()

	return &CleanupResponse{DeletedCount: rowsAffected}, nil
}

// Define the Cron Job to periodically run Cleanup every hour.
var _ = cron.NewJob("cleanup-records", cron.JobConfig{
	Title:    "Clean up records older than 24 hours",
	Every:    1 * cron.Hour,
	Endpoint: Cleanup,
})
