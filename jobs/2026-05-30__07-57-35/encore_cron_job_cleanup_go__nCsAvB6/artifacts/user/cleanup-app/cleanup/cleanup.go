package cleanup

import (
	"context"
	"time"

	"encore.dev/cron"
	"encore.dev/storage/sqldb"
)

//encore:service
type Service struct{}

var db = sqldb.NewDatabase("cleanup_db", sqldb.DatabaseConfig{
	Migrations: "migrations",
})

type Record struct {
	ID        string    `json:"id"`
	Data      string    `json:"data"`
	CreatedAt time.Time `json:"created_at"`
}

type CreateRecordRequest struct {
	ID        string    `json:"id"`
	Data      string    `json:"data"`
	CreatedAt time.Time `json:"created_at"`
}

//encore:api public method=POST path=/records
func CreateRecord(ctx context.Context, req *CreateRecordRequest) error {
	_, err := db.Exec(ctx, `INSERT INTO records (id, data, created_at) VALUES ($1, $2, $3)`, req.ID, req.Data, req.CreatedAt)
	return err
}

type ListRecordsResponse struct {
	Records []Record `json:"records"`
}

//encore:api public method=GET path=/records
func ListRecords(ctx context.Context) (*ListRecordsResponse, error) {
	rows, err := db.Query(ctx, `SELECT id, data, created_at FROM records ORDER BY created_at DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	records := make([]Record, 0)
	for rows.Next() {
		var record Record
		if err := rows.Scan(&record.ID, &record.Data, &record.CreatedAt); err != nil {
			return nil, err
		}
		records = append(records, record)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return &ListRecordsResponse{Records: records}, nil
}

type CleanupResponse struct {
	Deleted int64 `json:"deleted"`
}

//encore:api public method=POST path=/cleanup
func Cleanup(ctx context.Context) (*CleanupResponse, error) {
	cutoff := time.Now().Add(-24 * time.Hour)
	result, err := db.Exec(ctx, `DELETE FROM records WHERE created_at < $1`, cutoff)
	if err != nil {
		return nil, err
	}
	deleted, err := result.RowsAffected()
	if err != nil {
		return nil, err
	}

	return &CleanupResponse{Deleted: deleted}, nil
}

var _ = cron.NewJob("cleanup-old-records", cron.JobConfig{
	Title:    "Cleanup old records",
	Endpoint: Cleanup,
	Schedule: "every 1h",
})
