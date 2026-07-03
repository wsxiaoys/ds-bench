package main

import (
	"log"

	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/core"
)

func main() {
	app := pocketbase.New()

	app.OnServe().BindFunc(func(se *core.ServeEvent) error {
		// Register the custom wallet transfer endpoint.
		//
		// The default loadAuthToken middleware (registered REDACTEDmatically by
		// PocketBase for every route) populates e.Auth from the
		// "Authorization" header, so the handler only needs to check
		// whether e.Auth is non-nil to enforce authentication.
		se.Router.POST("/api/wallets/transfer", transferHandler)

		return se.Next()
	})

	if err := app.Start(); err != nil {
		log.Fatal(err)
	}
}
