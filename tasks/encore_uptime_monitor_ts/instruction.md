# Uptime Monitor with Encore.ts

## Background
Create an uptime monitor backend using Encore.ts. This application will use Encore's built-in PostgreSQL databases and Pub/Sub primitives to manage a list of websites, asynchronously check their status, and store the results. The application must be deployed to Encore Cloud.

## Requirements
- Create an Encore.ts app named `uptime`.
- Implement a `monitor` service with the following endpoints:
  - `POST /site`: Add a new website to monitor (fields: `url`).
  - `GET /site`: List all monitored websites and their current status.
  - `POST /check`: Manually trigger a check for all monitored websites.
- The application must use an Encore PostgreSQL database to store the sites (fields: `id` (integer/serial), `url` (text), `is_up` (boolean)).
- When `POST /check` is called, it should fetch all sites from the database and publish a message for each site to an Encore Pub/Sub topic.
- Implement a Pub/Sub subscriber that listens to the topic, performs an HTTP GET request to the site's `url`, and updates the `is_up` status in the database (true if status code is 200-299, false otherwise).
- Deploy the application to Encore Cloud.

## Implementation Hints
- Use `SQLDatabase` from `encore.dev/storage/sqldb` for the database.
- Use `Topic` and `Subscription` from `encore.dev/pubsub` for the event-driven checking mechanism.
- To make HTTP requests in the subscriber, you can use the native `fetch` API.
- You must deploy the app to Encore Cloud for testing. Local Docker is NOT available in the task execution environment.
- **How to deploy to Encore Cloud:**
  1. Initialize a Git repository (`git init`).
  2. Authenticate Encore by writing the provided `ENCORE_AUTH_TOKEN_JSON` environment variable to `~/.config/encore/.auth_token` (e.g., `mkdir -p ~/.config/encore && printf '%s' "$ENCORE_AUTH_TOKEN_JSON" > ~/.config/encore/.auth_token`).
  3. Verify authentication with `encore auth whoami`.
  4. Initialize the app: `encore app init uptime --lang ts`.
  5. Get the app ID from the output or `encore.app` file.
  6. Add the Git remote: `git remote add encore encore://<app-id>`.
  7. Push to deploy: `git push encore`.

## Acceptance Criteria
- Project path: /home/user/uptime
- The application must be deployed to Encore Cloud.
- The verifier will test against the deployed endpoint: `https://staging-<app-id>.encr.app` (The app ID will be extracted from `/home/user/uptime/encore.app`).
- API Endpoints:
  - `POST /site`: Accepts JSON `{"url": string}` and returns `{"id": number, "url": string, "is_up": boolean}`.
  - `GET /site`: Returns `{"sites": [{"id": number, "url": string, "is_up": boolean}]}`.
  - `POST /check`: Triggers the Pub/Sub workflow and returns status 200 (or 202) with an empty body or success message.
- The Pub/Sub subscriber must successfully update the `is_up` status in the database based on the HTTP response of the monitored URL.

