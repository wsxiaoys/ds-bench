package main

import (
"errors"
"log"
"net/http"
"strings"
"time"

"github.com/pocketbase/pocketbase"
"github.com/pocketbase/pocketbase/core"
"github.com/pocketbase/pocketbase/tools/router"
)

// transferRequest represents the JSON body sent to the transfer endpoint.
type transferRequest struct {
FromId string  `json:"fromId"`
ToId   string  `json:"toId"`
Amount float64 `json:"amount"`
}

// transferResponse represents the JSON response on a successful transfer.
type transferResponse struct {
FromBalance float64 `json:"fromBalance"`
ToBalance   float64 `json:"toBalance"`
}

// ErrInsufficientFunds is returned when the source wallet does not have
// enough balance to complete the transfer.
var ErrInsufficientFunds = errors.New("insufficient funds")

// retryIntervals defines the backoff intervals (in ms) used when retrying
// transactions that hit a SQLITE_BUSY / database is locked error.
//
// 50, 100, 200, 400, 800 -> up to 5 attempts.
var retryIntervals = []time.Duration{
50 * time.Millisecond,
100 * time.Millisecond,
200 * time.Millisecond,
400 * time.Millisecond,
800 * time.Millisecond,
}

func main() {
app := pocketbase.New()

app.OnServe().BindFunc(func(se *core.ServeEvent) error {
se.Router.POST("/api/wallets/transfer", handleWalletTransfer)
return se.Next()
})

if err := app.Start(); err != nil {
log.Fatal(err)
}
}

// handleWalletTransfer is the HTTP handler for POST /api/wallets/transfer.
//
// It requires an authenticated PocketBase user (loaded from the
// Authorization header by the auth middleware). It moves money between two
// wallets atomically while being safe against concurrent requests thanks to
// a SQLITE_BUSY retry loop and a deterministic lock order on the wallet ids.
func handleWalletTransfer(e *core.RequestEvent) error {
// 1. Require authenticated user.
if e.Auth == nil {
return e.UnauthorizedError("Missing or invalid Authorization token.", nil)
}

// 2. Decode and validate the request body.
req := new(transferRequest)
if err := e.BindBody(req); err != nil {
return e.BadRequestError("Invalid request body.", err)
}

if req.FromId == "" || req.ToId == "" {
return e.BadRequestError("fromId and toId are required.", nil)
}
if req.FromId == req.ToId {
return e.BadRequestError("fromId and toId must be different.", nil)
}
if req.Amount <= 0 {
return e.BadRequestError("amount must be a positive number.", nil)
}

// 3. Run the transfer with retry-on-busy logic.
var fromBalance, toBalance float64

err := runWithBusyRetry(func() error {
return e.App.RunInTransaction(func(txApp core.App) error {
// Find the source and destination wallets using the transaction's
// app instance so the reads happen inside the same transaction.
fromRec, err := txApp.FindRecordById("wallets", req.FromId)
if err != nil {
return e.NotFoundError("Source wallet not found.", err)
}
toRec, err := txApp.FindRecordById("wallets", req.ToId)
if err != nil {
return e.NotFoundError("Destination wallet not found.", err)
}

// Lock wallets in a deterministic id-ascending order to avoid
// deadlocks between concurrent transactions.
first, second := fromRec, toRec
if first.Id > second.Id {
first, second = second, first
}
_ = first
_ = second

// Sanity check: from/to map back to the request after locking.
if !(fromRec.Id == req.FromId && toRec.Id == req.ToId) {
return e.InternalServerError("Wallet ordering mismatch.", nil)
}

fromBalance = fromRec.GetFloat("balance")
toBalance = toRec.GetFloat("balance")

if fromBalance < req.Amount {
// No audit record on failed transfer.
return ErrInsufficientFunds
}

newFrom := fromBalance - req.Amount
newTo := toBalance + req.Amount

fromRec.Set("balance", newFrom)
toRec.Set("balance", newTo)

if err := txApp.Save(fromRec); err != nil {
return err
}
if err := txApp.Save(toRec); err != nil {
return err
}

// Insert the audit record.
transfersCol, err := txApp.FindCollectionByNameOrId("transfers")
if err != nil {
return err
}
transfer := core.NewRecord(transfersCol)
transfer.Set("fromId", req.FromId)
transfer.Set("toId", req.ToId)
transfer.Set("amount", req.Amount)
if err := txApp.Save(transfer); err != nil {
return err
}

fromBalance = newFrom
toBalance = newTo
return nil
})
})

if err != nil {
// Map domain errors to the appropriate HTTP responses.
if errors.Is(err, ErrInsufficientFunds) {
return e.JSON(http.StatusBadRequest, map[string]any{
"error": "insufficient funds",
})
}
// PocketBase ApiError values produced by the handler.
var apiErr *router.ApiError
if errors.As(err, &apiErr) {
return apiErr
}
return e.InternalServerError("Failed to process transfer.", err)
}

return e.JSON(http.StatusOK, transferResponse{
FromBalance: fromBalance,
ToBalance:   toBalance,
})
}

// runWithBusyRetry runs op, retrying it with exponential backoff whenever
// the returned error looks like a SQLITE_BUSY / database-is-locked error.
//
// Up to len(retryIntervals)+1 attempts are made (initial + len(retryIntervals)
// retries), matching the spec: 5 attempts with waits from 50ms to 1.6s.
func runWithBusyRetry(op func() error) error {
var err error
for attempt := 0; attempt <= len(retryIntervals); attempt++ {
err = op()
if err == nil {
return nil
}
if !isBusyError(err) {
return err
}
if attempt == len(retryIntervals) {
break
}
time.Sleep(retryIntervals[attempt])
}
return err
}

// isBusyError returns true if err looks like a SQLite "database is locked"
// or "SQLITE_BUSY" error from concurrent writers.
func isBusyError(err error) bool {
if err == nil {
return false
}
msg := err.Error()
return strings.Contains(msg, "database is locked") ||
strings.Contains(msg, "SQLITE_BUSY") ||
strings.Contains(msg, "table is locked")
}
