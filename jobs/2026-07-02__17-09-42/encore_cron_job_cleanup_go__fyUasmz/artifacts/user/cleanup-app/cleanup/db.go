package cleanup

import "encore.dev/storage/sqldb"

// cleanupdb is the PostgreSQL database for the cleanup service.
// It is provisioned by Encore and the migrations are applied
// from the ./migrations directory at deploy time.
var cleanupdb = sqldb.NewDatabase("cleanup_db", sqldb.DatabaseConfig{
	Migrations: "./migrations",
})