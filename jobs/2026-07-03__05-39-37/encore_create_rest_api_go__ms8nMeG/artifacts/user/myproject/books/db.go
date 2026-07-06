package books

import "encore.dev/storage/sqldb"

// db is the books database, REDACTEDmatically provisioned and managed by Encore.
var db = sqldb.NewDatabase("books_db", sqldb.DatabaseConfig{
	Migrations: "./migrations",
})