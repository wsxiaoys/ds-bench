# Cron Job Cleanup in Encore.go

## Background
Create an Encore.go application that sets up a PostgreSQL database and a Cron Job to periodically clean up stale database records.

## Requirements
- Create an Encore application with a `cleanup` service.
- Define a PostgreSQL database named `cleanup_db` using `encore.dev/storage/sqldb`.
- Create a database migration to define a `records` table with `id` (text), `data` (text), and `created_at` (timestamp) columns.
- Expose a public API endpoint `POST /records` to insert a new record. It must accept `id`, `data`, and `created_at` in the request body to allow inserting historical records for testing.
- Expose a public API endpoint `GET /records` to list all records.
- Define an Encore Cron Job that runs periodically (e.g., every 1 hour) to delete records older than 24 hours.
- The Cron Job must call a public API endpoint `POST /cleanup` which contains the actual deletion logic. (Making it public allows manual triggering for verification).

## Implementation Hints
- Use `sqldb.NewDatabase` to define the database and point to the `migrations` directory.
- Use `cron.NewJob` from `encore.dev/cron` to define the Cron Job schedule and point it to the `POST /cleanup` API endpoint.
- The `POST /cleanup` API endpoint should execute a `DELETE` SQL query to remove records where `created_at` is older than 24 hours.
- Docker is NOT available in the task execution environment. You MUST deploy the app to Encore Cloud.
- To deploy the app to Encore Cloud:
  1. Run `git init` in your project folder.
  2. Authenticate Encore by writing the provided `ENCORE_AUTH_TOKEN_JSON` value to `~/.config/encore/.auth_token`: `mkdir -p ~/.config/encore && printf '%s' "$ENCORE_AUTH_TOKEN_JSON" > ~/.config/encore/.auth_token`
  3. Verify authentication with `encore auth whoami`.
  4. Initialize an Encore app: `encore app init cleanup-app --lang go`.
  5. Add the remote: `git remote add encore encore://<app-id>` (app-id can be found in `encore.app`).
  6. Commit and push: `git add -A . && git commit -m "Initial" && git push encore`.

## Acceptance Criteria
- Project path: /home/user/cleanup-app
- The app must be successfully deployed to Encore Cloud.
- API Endpoints (accessible via `https://staging-<app-id>.encr.app`):
  - `POST /records`: Accepts JSON `{"id": string, "data": string, "created_at": string}` (RFC3339 format) and inserts the record.
  - `GET /records`: Returns a JSON object containing an array of records (e.g., `{"records": [{"id": string, "data": string, "created_at": string}]}`).
  - `POST /cleanup`: Deletes records where `created_at` is older than 24 hours from the current time.

