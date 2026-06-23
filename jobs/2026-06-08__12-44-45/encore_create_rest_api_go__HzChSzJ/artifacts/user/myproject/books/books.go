package books

import (
	"context"
	"encoding/json"
	"net/http"

	"encore.dev/storage/sqldb"
)

type Book struct {
	ID     int    `json:"id"`
	Title  string `json:"title"`
	Author string `json:"author"`
}

type AddBookParams struct {
	Title  string `json:"title"`
	Author string `json:"author"`
}

type ListBooksResponse struct {
	Books []Book `json:"books"`
}

// Define the database
var db = sqldb.NewDatabase("books", sqldb.DatabaseConfig{
	Migrations: "./migrations",
})

//encore:api public method=POST path=/books
func AddBook(ctx context.Context, params *AddBookParams) (*Book, error) {
	var b Book
	err := db.QueryRow(ctx, `
		INSERT INTO books (title, author)
		VALUES ($1, $2)
		RETURNING id, title, author
	`, params.Title, params.Author).Scan(&b.ID, &b.Title, &b.Author)
	if err != nil {
		return nil, err
	}
	return &b, nil
}

//encore:api public raw method=GET path=/books
func ListBooks(w http.ResponseWriter, r *http.Request) {
	rows, err := db.Query(r.Context(), `
		SELECT id, title, author FROM books
	`)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	books := []Book{}
	for rows.Next() {
		var b Book
		if err := rows.Scan(&b.ID, &b.Title, &b.Author); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		books = append(books, b)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(books)
}
// trigger
