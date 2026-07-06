# Concurrent Wallet Transfer Endpoint

## Goal
A Go project that embeds PocketBase v0.31.0 is already scaffolded at `/home/user/myproject` with `wallets` and `transfers` collections seeded. Extend it so that authenticated users can move money between wallets via `POST /api/wallets/transfer` (body `{ "fromId": string, "toId": string, "amount": number }`) and the endpoint survives heavy concurrent load against the single-writer SQLite store.

## Implementation Hints
- **Build Target**: Compile your Go application to an executable named `myapp` located at `/home/user/myproject/myapp`.
- **Port and Data Directory**: The server will be started using `/home/user/myproject/myapp serve --http="0.0.0.0:8090" --dir=/home/user/myproject/pb_data`. Ensure your application correctly processes these standard PocketBase server arguments.
- **Authentication**: The `POST /api/wallets/transfer` endpoint must require a valid PocketBase user token (sent via the standard `Authorization` header). Any unauthenticated requests must be rejected with HTTP 401 or 403.
- **API Specifications**:
  - **Request Body**:
    ```json
    { "fromId": string, "toId": string, "amount": number }
    ```
  - **Success Response (HTTP 200)**: Return the updated balances of both wallets in the following JSON format:
    ```json
    { "fromBalance": number, "toBalance": number }
    ```
  - **Insufficient Funds (HTTP 400)**: If the source wallet does not have enough funds, return HTTP 400 with a JSON response containing an error message. The wallet balances must remain unchanged.
- **Transactional Integrity & Concurrency**:
  - Move the money between wallets in a secure, ACID-compliant database transaction.
  - Every successful transfer must insert a corresponding audit record into the `transfers` collection, while failed transfers must not insert any audit record.
  - Implement appropriate retry logic or concurrency handling (such as handling SQLite `database is locked` / `SQLITE_BUSY` errors) to ensure the endpoint can handle high concurrent requests safely without deadlocks, completing multiple simultaneous transactions reliably.
