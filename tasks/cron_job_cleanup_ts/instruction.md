# Encore.ts Cron Job and Database Cleanup

## Background
Encore is a backend framework that provides declarative infrastructure. In this task, you will create an Encore.ts application with a PostgreSQL database and a cron job that periodically cleans up stale records.

## Requirements
- Create an Encore.ts application. The app name MUST be `cron-app-${run-id}`, where `${run-id}` is read from the `ZEALT_RUN_ID` environment variable.
- Create a PostgreSQL database named `records_db`.
- Create a `records` table with `id` (serial primary key), `data` (text), and `created_at` (timestamp, defaults to now).
- Implement the following API endpoints in a service named `cleanup`:
  - `POST /records`: Accepts a JSON body with `data` (string) and an optional `created_at` (ISO string). Inserts a new record. If `created_at` is provided, use it; otherwise, use the current time. Returns the inserted record's `id`.
  - `GET /records`: Returns a JSON array of all records, ordered by `id`.
  - `POST /cleanup`: Deletes all records where `created_at` is older than 1 hour from the current time. Returns the number of deleted records.
- Define a Cron Job named `cleanup-job` that calls the `POST /cleanup` endpoint every 1 hour (`every: "1h"`).
- Deploy the application to Encore Cloud.

## Implementation Hints
- Read the current `run-id` from the `ZEALT_RUN_ID` environment variable.
- Use `encore app init cron-app-${run-id} --lang ts` to initialize the project.
- Use `encore.dev/storage/sqldb` for the database.
- Use `encore.dev/cron` to define the cron job.
- To deploy to Encore Cloud:
  1. Initialize a Git repository (`git init`).
  2. Authenticate Encore by writing the provided `ENCORE_AUTH_TOKEN_JSON` value to `~/.config/encore/.auth_token`:
     `mkdir -p ~/.config/encore && printf '%s' "$ENCORE_AUTH_TOKEN_JSON" > ~/.config/encore/.auth_token`
  3. Add the Encore Git remote: `git remote add encore encore://<app-id>` (extract the app ID from `encore.app`).
  4. Push to deploy: `git push encore`
- Wait for the deployment to finish before completing the task. The deployment takes about 2 minutes.

## Acceptance Criteria
- Project path: /home/user/cron-app-${run-id}
- Ensure the application is deployed to Encore Cloud.
- The Encore app name must be `cron-app-${run-id}` where `run-id` is read from the `ZEALT_RUN_ID` environment variable.
- API Endpoints (accessible at `https://staging-<app-id>.encr.app`):
  - `POST /records`:
    - Request: `{"data": "test", "created_at": "2020-01-01T00:00:00Z"}`
    - Response: `{"id": number}`
  - `GET /records`:
    - Response: `[{"id": number, "data": "string", "created_at": "string"}]`
  - `POST /cleanup`:
    - Response: `{"deleted_count": number}`
- The `POST /cleanup` endpoint must successfully delete records older than 1 hour.

