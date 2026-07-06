package book

import (
	"context"
	"encoding/json"
	"net/http"

	"encore.dev/storage/sqldb"
)

// Define the database named "books"
var db = sqldb.NewDatabase("books", sqldb.DatabaseConfig{
	Migrations: "./migrations",
})

type Book struct {
	ID     int64  `json:"id"`
	Title  string `json:"title"`
	Author string `json:"author"`
}

type AddBookParams struct {
	Title  string `json:"title"`
	Author string `json:"author"`
}

// AddBook adds a new book.
//encore:api public path=/books method=POST
func AddBook(ctx context.Context, params *AddBookParams) (*Book, error) {
	var b Book
	err := db.QueryRow(ctx, "INSERT INTO books (title, author) VALUES ($1, $2) RETURNING id, title, author", params.Title, params.Author).Scan(&b.ID, &b.Title, &b.Author)
	if err != nil {
		return nil, err
	}
	return &b, nil
}

// ListBooks lists all books.
//encore:api public raw path=/books method=GET
func ListBooks(w http.ResponseWriter, req *http.Request) {
	rows, err := db.Query(req.Context(), "SELECT id, title, author FROM books")
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
	if err := rows.Err(); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(books); err != nil {
		return
	}
}
