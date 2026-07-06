package main

import (
	"errors"
	"math"
	"strings"
	"time"

	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase/core"
)

// transferRequest is the JSON payload accepted by the
// POST /api/wallets/transfer endpoint.
type transferRequest struct {
	FromID string  `json:"fromId"`
	ToID   string  `json:"toId"`
	Amount float64 `json:"amount"`
}

// transferResponse is the JSON payload returned on a successful transfer.
type transferResponse struct {
	FromBalance float64 `json:"fromBalance"`
	ToBalance   float64 `json:"toBalance"`
}

// transferErrorResponse is the JSON payload returned when a transfer fails
// for a non-auth reason (e.g. insufficient funds, invalid input).
type transferErrorResponse struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

// errInsufficientFunds is the sentinel error returned by the in-transaction
// worker when the source wallet has less money than the requested amount.
// It is unwrapped to a 400 response in the outer handler.
var errInsufficientFunds = errors.New("insufficient funds")

// errWalletNotFound is the sentinel error returned when one of the
// referenced wallets does not exist.
var errWalletNotFound = errors.New("wallet not found")

// retry configuration for the RunInTransaction loop.
//
// The endpoint will retry the whole transaction up to maxRetries times when
// the previous attempt failed with a transient SQLite "database is locked"
// (SQLITE_BUSY) error. The sleep between attempts uses an exponential
// backoff starting at 50ms and doubling each time, capped at 1.6s, so the
// sequence is 50ms, 100ms, 200ms, 400ms, 800ms (4 backoff sleeps between 5
// total attempts).
const (
	maxRetries    = 5
	initialBackoff = 50 * time.Millisecond
	maxBackoff     = 1600 * time.Millisecond
)

// transferHandler implements POST /api/wallets/transfer.
//
// Authentication is enforced by checking e.Auth, which is loaded by
// PocketBase's default loadAuthToken middleware from the "Authorization"
// header. When the request is unauthenticated we return a 401 (the
// behaviour also matches PocketBase's built-in RequireAuth middleware).
func transferHandler(e *core.RequestEvent) error {
	if e.Auth == nil {
		return e.UnauthorizedError("The request requires valid auth token.", nil)
	}

	var req transferRequest
	if err := e.BindBody(&req); err != nil {
		return e.BadRequestError("Invalid or missing JSON body.", err)
	}

	req.FromID = strings.TrimSpace(req.FromID)
	req.ToID = strings.TrimSpace(req.ToID)

	if req.FromID == "" || req.ToID == "" {
		return e.BadRequestError("fromId and toID are required.", nil)
	}
	if req.FromID == req.ToID {
		return e.BadRequestError("fromId and toId must be different wallets.", nil)
	}
	if math.IsNaN(req.Amount) || math.IsInf(req.Amount, 0) {
		return e.BadRequestError("amount must be a finite number.", nil)
	}
	if req.Amount <= 0 {
		return e.BadRequestError("amount must be greater than zero.", nil)
	}

	fromBalance, toBalance, err := runTransferWithRetry(e.App, req)
	if err == nil {
		return e.JSON(200, transferResponse{
			FromBalance: fromBalance,
			ToBalance:   toBalance,
		})
	}

	// Map known sentinel errors to a 400 response with a structured body.
	// Everything else (including a final SQLITE_BUSY after exhausting all
	// retries) is reported as a 500.
	if errors.Is(err, errInsufficientFunds) {
		return e.JSON(400, transferErrorResponse{
			Code:    "insufficient_funds",
			Message: "Source wallet does not have enough funds for this transfer.",
		})
	}
	if errors.Is(err, errWalletNotFound) {
		return e.JSON(400, transferErrorResponse{
			Code:    "wallet_not_found",
			Message: "One of the wallets could not be found.",
		})
	}

	e.App.Logger().Error("wallet transfer failed", "error", err)
	return e.InternalServerError("Failed to process transfer.", err)
}

// runTransferWithRetry wraps performTransfer with an exponential-backoff
// retry loop for transient SQLITE_BUSY errors. The total number of
// attempts is bounded by maxRetries (5 by default).
func runTransferWithRetry(app core.App, req transferRequest) (float64, float64, error) {
	backoff := initialBackoff

	var lastErr error
	for attempt := 1; attempt <= maxRetries; attempt++ {
		fromBalance, toBalance, err := performTransfer(app, req)
		if err == nil {
			return fromBalance, toBalance, nil
		}
		if !isTransientLockError(err) {
			return 0, 0, err
		}
		lastErr = err

		if attempt == maxRetries {
			break
		}

		time.Sleep(backoff)
		backoff *= 2
		if backoff > maxBackoff {
			backoff = maxBackoff
		}
	}

	return 0, 0, lastErr
}

// performTransfer executes a single transfer attempt inside a
// PocketBase-managed database transaction.
//
// Lock ordering: both wallet rows are always locked in id-ascending order
// (i.e. the row with the lexicographically smaller id is updated first),
// which ensures that two concurrent transfers involving the same pair of
// wallets always acquire the locks in the same order and therefore cannot
// deadlock against each other.
//
// The balance change is performed with a conditional UPDATE that fails
// (rowsAffected == 0) if the source wallet has insufficient funds, so the
// check and the debit happen atomically in the same statement.
func performTransfer(app core.App, req transferRequest) (float64, float64, error) {
	// Determine the consistent lock order up front. The "first" wallet
	// is the one whose id is lexicographically smaller, and the "second"
	// wallet is the other one.
	firstID, secondID := req.FromID, req.ToID
	if firstID > secondID {
		firstID, secondID = secondID, firstID
	}
	firstIsFrom := firstID == req.FromID
	secondIsFrom := secondID == req.FromID

	var fromBalance, toBalance float64

	err := app.RunInTransaction(func(txApp core.App) error {
		db := txApp.NonconcurrentDB().(*dbx.Tx)

		// executeUpdate runs the conditional/unconditional balance
		// update for the given wallet. When 0 rows are affected on a
		// source-side update it disambiguates insufficient-funds from
		// wallet-not-found by checking whether the row exists.
		executeUpdate := func(id string, isSource bool) error {
			rows, err := updateWalletBalance(db, id, isSource, req.Amount)
			if err != nil {
				return err
			}
			if rows > 0 {
				return nil
			}
			// Zero rows updated.
			if isSource {
				exists, lookupErr := walletExists(db, id)
				if lookupErr != nil {
					return lookupErr
				}
				if !exists {
					return errWalletNotFound
				}
				return errInsufficientFunds
			}
			return errWalletNotFound
		}

		// First lock: update the lexicographically smaller wallet.
		// The source side (if it is the smaller id) uses a
		// conditional UPDATE that fails on insufficient funds; the
		// destination side is an unconditional credit.
		if err := executeUpdate(firstID, firstIsFrom); err != nil {
			return err
		}

		// Second lock: update the other wallet in the same way.
		if err := executeUpdate(secondID, secondIsFrom); err != nil {
			return err
		}

		// Read the post-update balances so the response can reflect
		// the final state of both wallets.
		firstBalance, err := getWalletBalance(db, firstID)
		if err != nil {
			return err
		}
		secondBalance, err := getWalletBalance(db, secondID)
		if err != nil {
			return err
		}

		if firstIsFrom {
			fromBalance = firstBalance
			toBalance = secondBalance
		} else {
			fromBalance = secondBalance
			toBalance = firstBalance
		}

		// Audit trail: insert one record in the transfers collection
		// per successful transfer. We do this inside the transaction
		// so that a failed (rolled-back) transfer never produces an
		// audit row.
		transfersCol, err := txApp.FindCachedCollectionByNameOrId("transfers")
		if err != nil {
			return err
		}
		audit := core.NewRecord(transfersCol)
		audit.Set("fromId", req.FromID)
		audit.Set("toId", req.ToID)
		audit.Set("amount", req.Amount)
		if err := txApp.Save(audit); err != nil {
			return err
		}

		return nil
	})

	if err != nil {
		return 0, 0, err
	}

	return fromBalance, toBalance, nil
}

// updateWalletBalance performs the atomic balance update for a single
// wallet. When isSource is true the statement is guarded by
// `balance >= ?amount` so that a debit exceeding the current balance
// affects zero rows and is detected by the caller. When isSource is
// false it is a plain credit.
func updateWalletBalance(db dbx.Builder, id string, isSource bool, amount float64) (int64, error) {
	if isSource {
		res, err := db.Update(
			"wallets",
			dbx.Params{
				"balance": dbx.NewExp("balance - {:amt}", dbx.Params{"amt": amount}),
			},
			dbx.HashExp{
				"id":      id,
				"balance": dbx.NewExp("balance >= {:amt}", dbx.Params{"amt": amount}),
			},
		).Execute()
		if err != nil {
			return 0, err
		}
		return res.RowsAffected()
	}

	res, err := db.Update(
		"wallets",
		dbx.Params{
			"balance": dbx.NewExp("balance + {:amt}", dbx.Params{"amt": amount}),
		},
		dbx.HashExp{
			"id": id,
		},
	).Execute()
	if err != nil {
		return 0, err
	}
	return res.RowsAffected()
}

// walletExists returns true if a wallet with the given id exists in the
// wallets table. Used to distinguish missing-wallet from
// insufficient-funds errors when a conditional debit affected zero rows.
func walletExists(db dbx.Builder, id string) (bool, error) {
	var count int64
	err := db.Select("COUNT(*)").
		From("wallets").
		Where(dbx.HashExp{"id": id}).
		Row(&count)
	if err != nil {
		return false, err
	}
	return count > 0, nil
}

// getWalletBalance returns the current balance of the wallet with the
// given id. The caller is expected to invoke this only for a wallet that
// is known to exist.
func getWalletBalance(db dbx.Builder, id string) (float64, error) {
	var balance float64
	err := db.Select("balance").
		From("wallets").
		Where(dbx.HashExp{"id": id}).
		Row(&balance)
	if err != nil {
		return 0, err
	}
	return balance, nil
}

// isTransientLockError reports whether err is a transient SQLite lock
// conflict that the retry loop should attempt to recover from. We match
// both the modernc.org/sqlite wording ("database is locked" /
// "SQLITE_BUSY") and the generic driver wording.
func isTransientLockError(err error) bool {
	if err == nil {
		return false
	}
	msg := strings.ToLower(err.Error())
	return strings.Contains(msg, "database is locked") ||
		strings.Contains(msg, "sqlite_busy") ||
		strings.Contains(msg, "sql state: 5")
}
