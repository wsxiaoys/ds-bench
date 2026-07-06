// Package book implements a simple REST API for managing books.
package book

import (
	"context"
	"encoding/json"
	"fmt"

	"encore.dev/storage/sqldb"
)

// Book represents a book in the catalogue.
type Book struct {
	ID     int64  `json:"id"`
	Title  string `json:"title"`
	Author string `json:"author"`
}

// AddBookParams defines the input for adding a new book.
type AddBookParams struct {
	Title  string `json:"title"`
	Author string `json:"author"`
}

// BookList is an alias for []*Book that lets us render the response as a
// top-level JSON array by implementing MarshalJSON on the value receiver.
type BookList []*Book

// MarshalJSON renders the BookList as a JSON array of books so the HTTP
// response body is a top-level array (as per the API contract).
func (b BookList) MarshalJSON() ([]byte, error) {
	if b == nil {
		return []byte("[]"), nil
	}
	return json.Marshal([]*Book(b))
}

// ListBooksResponse is the response type returned by ListBooks. Encore
// requires API response types to be named structs, so we wrap the slice.
type ListBooksResponse struct {
	Books BookList `json:"books"`
}

// db is the PostgreSQL database used by the book service.
// Encore REDACTEDmatically provisions and connects to this database based on
// the static declaration below.
var db = sqldb.NewDatabase("book", sqldb.DatabaseConfig{
	Migrations: "migrations",
})

// AddBook creates a new book entry.
//
//encore:api public path=/books method=POST
func AddBook(ctx context.Context, params *AddBookParams) (*Book, error) {
	if params.Title == "" || params.Author == "" {
		return nil, fmt.Errorf("title and author are required")
	}

	var b Book
	err := db.QueryRow(ctx, `
		INSERT INTO books (title, author)
		VALUES ($1, $2)
		RETURNING id, title, author
	`, params.Title, params.Author).Scan(&b.ID, &b.Title, &b.Author)
	if err != nil {
		return nil, fmt.Errorf("failed to insert book: %w", err)
	}

	return &b, nil
}

// ListBooks returns all books currently stored.
//
//encore:api public path=/books method=GET
func ListBooks(ctx context.Context) (*ListBooksResponse, error) {
	rows, err := db.Query(ctx, `SELECT id, title, author FROM books ORDER BY id`)
	if err != nil {
		return nil, fmt.Errorf("failed to query books: %w", err)
	}
	defer rows.Close()

	books := []*Book{}
	for rows.Next() {
		var b Book
		if err := rows.Scan(&b.ID, &b.Title, &b.Author); err != nil {
			return nil, fmt.Errorf("failed to scan book: %w", err)
		}
		books = append(books, &b)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating books: %w", err)
	}

	return &ListBooksResponse{Books: BookList(books)}, nil
}
