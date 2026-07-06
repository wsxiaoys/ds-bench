package main

import (
	"errors"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/core"
	"modernc.org/sqlite"
)

func isSqliteBusy(err error) bool {
	if err == nil {
		return false
	}
	errStr := err.Error()
	if strings.Contains(errStr, "SQLITE_BUSY") || strings.Contains(errStr, "database is locked") {
		return true
	}
	var sqliteErr *sqlite.Error
	if errors.As(err, &sqliteErr) {
		code := sqliteErr.Code()
		if code == 5 || code == 261 {
			return true
		}
	}
	return false
}

func main() {
	app := pocketbase.New()

	app.OnServe().BindFunc(func(se *core.ServeEvent) error {
		se.Router.POST("/api/wallets/transfer", func(e *core.RequestEvent) error {
			var req struct {
				FromId string  `json:"fromId"`
				ToId   string  `json:"toId"`
				Amount float64 `json:"amount"`
			}
			if err := e.BindBody(&req); err != nil {
				return e.BadRequestError("Invalid request body", err)
			}

			if req.FromId == "" || req.ToId == "" {
				return e.BadRequestError("fromId and toId are required fields", nil)
			}

			if req.FromId == req.ToId {
				return e.BadRequestError("Cannot transfer to the same wallet", nil)
			}

			if req.Amount <= 0 {
				return e.BadRequestError("Amount must be greater than zero", nil)
			}

			var fromBalance, toBalance float64
			var errBusiness error

			delay := 50 * time.Millisecond
			maxAttempts := 5
			var txErr error

			for attempt := 1; attempt <= maxAttempts; attempt++ {
				txErr = app.RunInTransaction(func(txApp core.App) error {
					// 1. Lock both wallets in a consistent id-ascending order
					var firstWallet, secondWallet *core.Record
					var err error

					if req.FromId < req.ToId {
						firstWallet, err = txApp.FindRecordById("wallets", req.FromId)
						if err != nil {
							return err
						}
						secondWallet, err = txApp.FindRecordById("wallets", req.ToId)
						if err != nil {
							return err
						}
					} else {
						firstWallet, err = txApp.FindRecordById("wallets", req.ToId)
						if err != nil {
							return err
						}
						secondWallet, err = txApp.FindRecordById("wallets", req.FromId)
						if err != nil {
							return err
						}
					}

					// Identify which is from and which is to
					var fromWallet, toWallet *core.Record
					if firstWallet.Id == req.FromId {
						fromWallet = firstWallet
						toWallet = secondWallet
					} else {
						fromWallet = secondWallet
						toWallet = firstWallet
					}

					// Check balance
					fBal := fromWallet.GetFloat("balance")
					if fBal < req.Amount {
						errBusiness = errors.New("insufficient funds")
						return errBusiness
					}

					// Update balances
					fromWallet.Set("balance", fBal-req.Amount)
					toWallet.Set("balance", toWallet.GetFloat("balance")+req.Amount)

					// Save in consistent ID-ascending order
					if err := txApp.Save(firstWallet); err != nil {
						return err
					}
					if err := txApp.Save(secondWallet); err != nil {
						return err
					}

					// Write audit row in the transfers collection
					transfersCollection, err := txApp.FindCollectionByNameOrId("transfers")
					if err != nil {
						return err
					}
					transferRecord := core.NewRecord(transfersCollection)
					transferRecord.Set("fromId", req.FromId)
					transferRecord.Set("toId", req.ToId)
					transferRecord.Set("amount", req.Amount)
					if err := txApp.Save(transferRecord); err != nil {
						return err
					}

					fromBalance = fromWallet.GetFloat("balance")
					toBalance = toWallet.GetFloat("balance")
					errBusiness = nil // clear business error if any from previous attempts
					return nil
				})

				if txErr == nil {
					break
				}

				// If it's a business error (e.g. insufficient funds), do not retry
				if errBusiness != nil {
					break
				}

				// If it's not a sqlite busy error, do not retry
				if !isSqliteBusy(txErr) {
					break
				}

				// Retry with backoff
				if attempt < maxAttempts {
					time.Sleep(delay)
					delay *= 2
					if delay > 1600*time.Millisecond {
						delay = 1600 * time.Millisecond
					}
				}
			}

			if txErr != nil {
				if errBusiness != nil {
					return e.BadRequestError(errBusiness.Error(), nil)
				}
				// If wallet is not found, return bad request or not found error
				if strings.Contains(txErr.Error(), "sql: no rows in result set") || strings.Contains(txErr.Error(), "not found") {
					return e.BadRequestError("Wallet not found", nil)
				}
				return e.BadRequestError(txErr.Error(), nil)
			}

			return e.JSON(http.StatusOK, map[string]any{
				"fromBalance": fromBalance,
				"toBalance":   toBalance,
			})
		}).Bind(apis.RequireAuth("users"))

		return se.Next()
	})

	if err := app.Start(); err != nil {
		log.Fatal(err)
	}
}
