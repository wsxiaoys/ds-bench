# Create a REST API with Encore for Go

## Background
Create a simple REST API for managing a list of books using Encore for Go and its built-in PostgreSQL database provisioning, then deploy it to Encore Cloud.

## Requirements
- Create a new Encore application.
- The application name must be `books-api-${run-id}`.
- Implement a RESTful API with the following endpoints:
  - POST `/books`: Add a new book.
    - Request JSON body: `{"title": "string", "author": "string"}`
    - Response JSON body: `{"id": number, "title": "string", "author": "string"}`
  - GET `/books`: List all books.
    - Response JSON body: `[{"id": number, "title": "string", "author": "string"}]`
- Store data in a PostgreSQL database using Encore's `sqldb` package.
- Deploy the application to Encore Cloud.
- Save the Encore App ID to a log file after deployment.

## Implementation Hints
- Read the `run-id` from `/logs/artifacts/run-id`.
- To deploy an Encore app to Encore Cloud:
  1. Initialize a Git repository with `git init`.
  2. Authenticate Encore by writing the provided `ENCORE_AUTH_TOKEN_JSON` value to `~/.config/encore/.auth_token`: `mkdir -p ~/.config/encore && printf '%s' "$ENCORE_AUTH_TOKEN_JSON" > ~/.config/encore/.auth_token`.
  3. Run `encore auth whoami` to confirm authentication.
  4. Initialize the app using `encore app init books-api-${run-id} --lang go`.
  5. Add the Encore Git remote: `git remote add encore encore://<app-id>`.
  6. Commit your code and push to the Encore remote: `git push encore`.
  7. The deployed endpoint will be available at `https://staging-<app-id>.encr.app/`.
- Use `encore.dev/storage/sqldb` to define the database and create a migration file (e.g., `1_create_tables.up.sql`) to create the `books` table.
- Write the App ID to `/home/user/myproject/output.log` in the format: `App ID: <app-id>`.

