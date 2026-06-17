# Migrate a Gin Application to Encore (Go)

## Background
You have an existing simple Go application built with the Gin framework. To simplify infrastructure management, you need to migrate this application to the Encore backend framework and deploy it to Encore Cloud.

## Requirements
- Initialize an Encore app using Go in the project directory.
- Use the app name `ginmigrate-${run-id}` to ensure uniqueness.
- Implement the following API endpoints using Encore's declarative approach (migrated from the original Gin app):
  - `GET /hello/:name`: Returns a JSON object with a `message` field containing `Hello, <name>!`.
  - `GET /ping`: Returns a JSON object with a `message` field containing `pong`.
- Deploy the migrated application to Encore Cloud.

## Implementation Hints
- Read the current `run-id` from the `ZEALT_RUN_ID` environment variable.
- Define APIs in Go using the `//encore:api public path=...` annotation.
- Ensure your Go structs use JSON tags (e.g., ``json:"message"``) to match the required response format.
- **IMPORTANT**: Docker is NOT available in the task execution environment. You MUST deploy the app to Encore Cloud for verification.
- Here is a simple guide to deploy an Encore app to Encore Cloud:
  1. Initialize a Git repository (`git init`).
  2. Authenticate Encore by writing the provided `ENCORE_AUTH_TOKEN_JSON` value to `~/.config/encore/.auth_token` (`mkdir -p ~/.config/encore && printf '%s' "$ENCORE_AUTH_TOKEN_JSON" > ~/.config/encore/.auth_token`).
  3. Initialize the Encore app: `encore app init ginmigrate-${run-id} --lang go`.
  4. Add the Encore Git remote: `git remote add encore encore://<app-id>` (extract `<app-id>` from `encore.app`).
  5. Commit your code and push to the Encore remote: `git add -A . && git commit -m 'Deploy' && git push encore`.

## Acceptance Criteria
- Project path: /home/user/myproject
- Ensure the app is deployed to Encore Cloud.
- The app ID must be readable from `/home/user/myproject/encore.app`.
- The deployed endpoint `https://staging-<app-id>.encr.app/hello/:name` must return HTTP 200 and JSON `{"message": "Hello, <name>!"}`.
- The deployed endpoint `https://staging-<app-id>.encr.app/ping` must return HTTP 200 and JSON `{"message": "pong"}`.

