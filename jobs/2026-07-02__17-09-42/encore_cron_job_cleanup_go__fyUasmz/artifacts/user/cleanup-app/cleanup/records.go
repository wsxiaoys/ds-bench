package cleanup

import (
	"context"
	"time"
)

// Record represents a row in the records table as it is exchanged
// over the HTTP API.
type Record struct {
	ID        string `json:"id"`
	Data      string `json:"data"`
	CreatedAt string `json:"created_at"`
}

// CreateRecordParams is the request body for POST /records.
// CreatedAt is expected to be an RFC3339 formatted timestamp string.
type CreateRecordParams struct {
	ID        string `json:"id"`
	Data      string `json:"data"`
	CreatedAt string `json:"created_at"`
}

// CreateRecordResponse is the response body for POST /records.
type CreateRecordResponse struct {
	Record *Record `json:"record"`
}

// CreateRecord inserts a new record into the records table.
//
//encore:api public method=POST path=/records
func CreateRecord(ctx context.Context, p *CreateRecordParams) (*CreateRecordResponse, error) {
	createdAt, err := time.Parse(time.RFC3339, p.CreatedAt)
	if err != nil {
		return nil, err
	}

	_, err = cleanupdb.Exec(ctx, `
		INSERT INTO records (id, data, created_at)
		VALUES ($1, $2, $3)
	`, p.ID, p.Data, createdAt)
	if err != nil {
		return nil, err
	}

	return &CreateRecordResponse{
		Record: &Record{
			ID:        p.ID,
			Data:      p.Data,
			CreatedAt: p.CreatedAt,
		},
	}, nil
}

// ListRecordsResponse is the response body for GET /records.
type ListRecordsResponse struct {
	Records []*Record `json:"records"`
}

// ListRecords returns all records ordered by their created_at timestamp.
//
//encore:api public method=GET path=/records
func ListRecords(ctx context.Context) (*ListRecordsResponse, error) {
	rows, err := cleanupdb.Query(ctx, `
		SELECT id, data, created_at
		FROM records
		ORDER BY created_at ASC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	records := []*Record{}
	for rows.Next() {
		var (
			id        string
			data      string
			createdAt time.Time
		)
		if err := rows.Scan(&id, &data, &createdAt); err != nil {
			return nil, err
		}
		records = append(records, &Record{
			ID:        id,
			Data:      data,
			CreatedAt: createdAt.UTC().Format(time.RFC3339),
		})
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	return &ListRecordsResponse{Records: records}, nil
}