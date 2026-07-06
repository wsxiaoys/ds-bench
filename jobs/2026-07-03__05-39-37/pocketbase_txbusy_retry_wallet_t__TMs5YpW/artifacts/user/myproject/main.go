package main

import (
	"log"

	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/core"
)

func main() {
	app := pocketbase.New()

	app.OnServe().BindFunc(func(se *core.ServeEvent) error {
		// TODO: Register POST /api/wallets/transfer here.
		// The handler MUST run inside app.RunInTransaction, lock both wallets
		// in a consistent id-ascending order, retry on SQLITE_BUSY with
		// exponential backoff (up to 5 attempts, 50ms..1.6s), and write an
		// audit row in the `transfers` collection.
		return se.Next()
	})

	if err := app.Start(); err != nil {
		log.Fatal(err)
	}
}
