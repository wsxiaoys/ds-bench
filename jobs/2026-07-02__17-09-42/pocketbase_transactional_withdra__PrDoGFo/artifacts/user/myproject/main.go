package main

import (
	"log"

	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/plugins/migratecmd"

	_ "myproject/migrations"
)

func main() {
	app := pocketbase.New()

	migratecmd.MustRegister(app, app.RootCmd, migratecmd.Config{
		Automigrate: false,
	})

	// OnRecordCreateRequest wraps the public REST POST /api/collections/withdrawals/records
	// endpoint. We validate the payload, debit the referenced wallet, and let PocketBase's
	// default save logic persist the withdrawal record -- all inside a single SQLite
	// transaction so the writer never deadlocks.
	app.OnRecordCreateRequest("withdrawals").BindFunc(func(e *core.RecordRequestEvent) error {
		amount := e.Record.GetFloat("amount")
		walletId := e.Record.GetString("wallet")

		// Pure payload validation -- no DB access required, so we can short-circuit
		// before opening a transaction.
		if amount <= 0 {
			return e.BadRequestError("amount must be strictly greater than 0", nil)
		}
		if walletId == "" {
			return e.BadRequestError("wallet reference is required", nil)
		}

		// Atomically: load the wallet (txApp), check funds, debit it, and persist
		// the withdrawal record. Every DB operation must go through txApp --
		// using the outer app / e.App would deadlock the SQLite writer.
		return app.RunInTransaction(func(txApp core.App) error {
			wallet, err := txApp.FindRecordById("wallets", walletId)
			if err != nil {
				return e.BadRequestError("referenced wallet does not exist", nil)
			}

			balance := wallet.GetFloat("balance")
			if balance < amount {
				return e.BadRequestError("insufficient funds", nil)
			}

			// Debit the wallet first; if the downstream chain (which saves the
			// withdrawal row) fails, the whole transaction rolls back and this
			// decrement is undone REDACTEDmatically.
			wallet.Set("balance", balance-amount)
			if err := txApp.Save(wallet); err != nil {
				return err
			}

			// Re-point e.App at the transactional app so that PocketBase's default
			// save logic for the withdrawal record participates in the same
			// transaction. Forgetting this is the classic v0.23+ pitfall that
			// silently aborts the chain (and deadlocks the writer).
			e.App = txApp

			// Propagate to PocketBase's built-in save handler. Returning a non-nil
			// error here will roll the transaction back, leaving the wallet
			// untouched as required.
			return e.Next()
		})
	})

	if err := app.Start(); err != nil {
		log.Fatal(err)
	}
}