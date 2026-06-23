package books

import (
	"context"
	"encoding/json"
	"net/http"

	"encore.dev/storage/sqldb"
)

// Define the books database using Encore's sqldb package.
var db = sqldb.NewDatabase("books", sqldb.DatabaseConfig{
	Migrations: "./migrations",
})

// Book represents a book in the library.
type Book struct {
	ID     int64  `json:"id"`
	Title  string `json:"title"`
	Author string `json:"author"`
}

// AddBookRequest is the request body for adding a new book.
type AddBookRequest struct {
	Title  string `json:"title"`
	Author string `json:"author"`
}

// Add adds a new book to the library.
//
//encore:api public method=POST path=/books
func Add(ctx context.Context, req *AddBookRequest) (*Book, error) {
	book := &Book{
		Title:  req.Title,
		Author: req.Author,
	}
	err := db.QueryRow(ctx,
		"INSERT INTO books (title, author) VALUES ($1, $2) RETURNING id",
		req.Title, req.Author,
	).Scan(&book.ID)
	if err != nil {
		return nil, err
	}
	return book, nil
}

// List returns all books in the library as a JSON array.
//
//encore:api public raw method=GET path=/books
func List(w http.ResponseWriter, req *http.Request) {
	rows, err := db.Query(req.Context(), "SELECT id, title, author FROM books ORDER BY id")
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	books := make([]*Book, 0)
	for rows.Next() {
		b := &Book{}
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
	json.NewEncoder(w).Encode(books)
}
