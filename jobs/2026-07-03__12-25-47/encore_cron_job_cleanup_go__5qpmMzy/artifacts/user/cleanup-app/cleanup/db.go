package cleanup

import "encore.dev/storage/sqldb"

//encore:service
var db = sqldb.NewDatabase("cleanup_db", sqldb.DatabaseConfig{
    Migrations: "./migrations",
})
