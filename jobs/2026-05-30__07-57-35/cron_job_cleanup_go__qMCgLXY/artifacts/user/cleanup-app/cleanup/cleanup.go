package cleanup

import (
	"context"
	"time"

	"encore.dev/cron"
	"encore.dev/storage/sqldb"
)

// Define the database
var cleanupDB = sqldb.NewDatabase("cleanup_db", sqldb.DatabaseConfig{
	Migrations: "./migrations",
})

// Request/Response types
type Record struct {
	ID        string `json:"id"`
	Data      string `json:"data"`
	CreatedAt string `json:"created_at"`
}

type InsertRequest struct {
	ID        string `json:"id"`
	Data      string `json:"data"`
	CreatedAt string `json:"created_at"`
}

type ListResponse struct {
	Records []Record `json:"records"`
}

type CleanupResponse struct {
	DeletedCount int `json:"deleted_count"`
}

//encore:api public method=POST path=/records
func InsertRecord(ctx context.Context, req *InsertRequest) error {
	_, err := cleanupDB.Exec(ctx, `
		INSERT INTO records (id, data, created_at)
		VALUES ($1, $2, $3)
	`, req.ID, req.Data, req.CreatedAt)
	return err
}

//encore:api public method=GET path=/records
func ListRecords(ctx context.Context) (*ListResponse, error) {
	rows, err := cleanupDB.Query(ctx, `
		SELECT id, data, created_at FROM records
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var records []Record
	for rows.Next() {
		var r Record
		var createdAt time.Time
		if err := rows.Scan(&r.ID, &r.Data, &createdAt); err != nil {
			return nil, err
		}
		r.CreatedAt = createdAt.Format(time.RFC3339)
		records = append(records, r)
	}
	if records == nil {
		records = []Record{}
	}
	return &ListResponse{Records: records}, nil
}

//encore:api public method=POST path=/cleanup
func Cleanup(ctx context.Context) (*CleanupResponse, error) {
	cutoff := time.Now().Add(-24 * time.Hour)
	result, err := cleanupDB.Exec(ctx, `
		DELETE FROM records WHERE created_at < $1
	`, cutoff)
	if err != nil {
		return nil, err
	}
	affected, _ := result.RowsAffected()
	return &CleanupResponse{DeletedCount: int(affected)}, nil
}

// Cron job that runs every hour to trigger cleanup
var _ = cron.NewJob("cleanup-cron", cron.JobConfig{
	Every:    1 * cron.Hour,
	Endpoint: Cleanup,
})