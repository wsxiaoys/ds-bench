package books

import (
	"context"
	"encoding/json"
	"net/http"
)

// Book represents a single book in the collection.
type Book struct {
	ID     int    `json:"id"`
	Title  string `json:"title"`
	Author string `json:"author"`
}

// AddBookParams is the request body for adding a new book.
type AddBookParams struct {
	Title  string `json:"title"`
	Author string `json:"author"`
}

// AddBook adds a new book to the collection.
//
//encore:api public method=POST path=/books
func AddBook(ctx context.Context, params AddBookParams) (*Book, error) {
	var id int
	err := db.QueryRow(ctx, `
		INSERT INTO books (title, author)
		VALUES ($1, $2)
		RETURNING id
	`, params.Title, params.Author).Scan(&id)
	if err != nil {
		return nil, err
	}
	return &Book{ID: id, Title: params.Title, Author: params.Author}, nil
}

// ListBooks returns all books in the collection as a JSON array.
//
//encore:api public raw method=GET path=/books
func ListBooks(w http.ResponseWriter, req *http.Request) {
	ctx := req.Context()
	rows, err := db.Query(ctx, `
		SELECT id, title, author FROM books
		ORDER BY id
	`)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var books []*Book
	for rows.Next() {
		b := &Book{}
		if err := rows.Scan(&b.ID, &b.Title, &b.Author); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		books = append(books, b)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(books)
}

