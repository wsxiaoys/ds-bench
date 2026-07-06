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

	registerWithdrawalHook(app)

	if err := app.Start(); err != nil {
		log.Fatal(err)
	}
}

// registerWithdrawalHook wraps the public record create request for the
// "withdrawals" collection so that a withdrawal is only accepted when the
// referenced wallet has sufficient funds, debiting the wallet balance
// atomically with the persisted withdrawal row.
func registerWithdrawalHook(app core.App) {
	app.OnRecordCreateRequest("withdrawals").BindFunc(func(e *core.RecordRequestEvent) error {
		// --- payload validation (no DB access needed) ---
		amount := e.Record.GetFloat("amount")
		if amount <= 0 {
			return e.BadRequestError("the `amount` field must be present and greater than 0", nil)
		}

		walletId := e.Record.GetString("wallet")

		// Everything from here on must run inside a single transaction so that
		// the wallet debit and the withdrawal row are committed (or rolled back)
		// together. Every DB operation inside the callback goes through the
		// transaction-scoped txApp to avoid deadlocking the WAL writer.
		return app.RunInTransaction(func(txApp core.App) error {
			// Validate that the wallet exists.
			wallet, err := txApp.FindRecordById("wallets", walletId)
			if err != nil || wallet == nil {
				return e.BadRequestError("the referenced `wallet` does not exist", nil)
			}

			// Validate sufficient funds.
			balance := wallet.GetFloat("balance")
			if balance < amount {
				return e.BadRequestError("insufficient funds", nil)
			}

			// Debit the wallet balance.
			wallet.Set("balance", balance-amount)
			if err := txApp.Save(wallet); err != nil {
				return err
			}

			// Make sure the withdrawal record carries the submitted values.
			e.Record.Set("wallet", walletId)
			e.Record.Set("amount", amount)
			// `note` is optional and already populated from the payload by the
			// request binding, so leave it untouched.

			// Re-point the request event's App at the transactional instance so
			// that the downstream chain (which actually persists the withdrawal
			// record) runs inside this same transaction. Restore the original
			// app afterwards for cleanliness.
			originalApp := e.App
			e.App = txApp
			nextErr := e.Next()
			e.App = originalApp
			return nextErr
		})
	})
}