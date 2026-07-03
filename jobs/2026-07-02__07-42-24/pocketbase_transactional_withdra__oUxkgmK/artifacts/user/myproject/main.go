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

	// Register withdrawals create hook
	app.OnRecordCreateRequest("withdrawals").BindFunc(func(e *core.RecordRequestEvent) error {
		// 1. Validate the incoming payload:
		reqInfo, _ := e.RequestInfo()

		// - The amount field must be present
		amountPresent := false
		if reqInfo != nil && reqInfo.Body != nil {
			_, amountPresent = reqInfo.Body["amount"]
		} else {
			amountPresent = e.Record.Get("amount") != nil
		}

		if !amountPresent {
			return e.BadRequestError("amount is required", nil)
		}

		// - strictly greater than 0
		amount := e.Record.GetFloat("amount")
		if amount <= 0 {
			return e.BadRequestError("amount must be strictly greater than 0", nil)
		}

		// - The wallet field must be present
		walletPresent := false
		if reqInfo != nil && reqInfo.Body != nil {
			_, walletPresent = reqInfo.Body["wallet"]
		} else {
			walletPresent = e.Record.Get("wallet") != nil
		}

		if !walletPresent {
			return e.BadRequestError("wallet is required", nil)
		}

		// - and reference an existing wallets record
		walletId := e.Record.GetString("wallet")
		if walletId == "" {
			return e.BadRequestError("wallet is required", nil)
		}

		// 2. Run a single PocketBase transaction:
		err := app.RunInTransaction(func(txApp core.App) error {
			// - Load the referenced wallet inside the transaction.
			wallet, err := txApp.FindRecordById("wallets", walletId)
			if err != nil {
				return e.BadRequestError("wallet not found", nil)
			}

			// - The wallet's current balance must be greater than or equal to the submitted amount.
			balance := wallet.GetFloat("balance")
			if balance < amount {
				return e.BadRequestError("insufficient funds", nil)
			}

			// - Decrease the referenced wallet's balance by exactly amount.
			wallet.Set("balance", balance-amount)
			if err := txApp.Save(wallet); err != nil {
				return err
			}

			// - Temporarily re-point e.App at the txApp for the duration of the callback
			// so that downstream save logic runs inside the transaction
			originalApp := e.App
			e.App = txApp
			defer func() {
				e.App = originalApp
			}()

			// - Propagate the request chain
			return e.Next()
		})

		return err
	})

	migratecmd.MustRegister(app, app.RootCmd, migratecmd.Config{
		Automigrate: false,
	})

	if err := app.Start(); err != nil {
		log.Fatal(err)
	}
}
