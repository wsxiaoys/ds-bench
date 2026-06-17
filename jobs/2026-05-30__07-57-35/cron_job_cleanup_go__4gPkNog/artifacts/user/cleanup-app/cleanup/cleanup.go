package cleanup

import (
	"context"
	"time"

	"encore.dev/storage/sqldb"
)

var db = sqldb.NewDatabase("cleanup_db", sqldb.DatabaseConfig{
	Migrations: "./migrations",
})

type Record struct {
	ID        string    `json:"id"`
	Data      string    `json:"data"`
	CreatedAt time.Time `json:"created_at"`
}

type InsertRecordRequest struct {
	ID        string    `json:"id"`
	Data      string    `json:"data"`
	CreatedAt time.Time `json:"created_at"`
}

//encore:api public method=POST path=/records
func InsertRecord(ctx context.Context, req *InsertRecordRequest) error {
	_, err := db.Exec(ctx, `
		INSERT INTO records (id, data, created_at)
		VALUES ($1, $2, $3)
	`, req.ID, req.Data, req.CreatedAt)
	return err
}

type ListRecordsResponse struct {
	Records []Record `json:"records"`
}

//encore:api public method=GET path=/records
func ListRecords(ctx context.Context) (*ListRecordsResponse, error) {
	rows, err := db.Query(ctx, `SELECT id, data, created_at FROM records`)
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

	return &ListRecordsResponse{Records: records}, nil
}

//encore:api public method=POST path=/cleanup
func CleanupStaleRecords(ctx context.Context) error {
	cutoff := time.Now().Add(-24 * time.Hour)
	_, err := db.Exec(ctx, `DELETE FROM records WHERE created_at < $1`, cutoff)
	return err
}
