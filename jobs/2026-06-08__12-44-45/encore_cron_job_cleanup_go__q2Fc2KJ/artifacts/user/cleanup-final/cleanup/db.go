package cleanup

import "encore.dev/storage/sqldb"

var db = sqldb.NewDatabase("cleanup_db", sqldb.DatabaseConfig{
	Migrations: "./migrations",
})
