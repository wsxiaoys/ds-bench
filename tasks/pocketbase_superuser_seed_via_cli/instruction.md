# PocketBase Superuser and Task Seeding via CLI

## Goal
Write an idempotent shell script `setup.sh` at `/home/user/myproject/setup.sh` that prepares a clean PocketBase v0.31.0 instance: creates a superuser non-interactively, applies a migration that defines a `tasks` collection, starts the server in the background, and seeds five predefined task records via the PocketBase REST API. 

## Requirements
- **Project Directory**: `/home/user/myproject`
- **PocketBase Binary**: PocketBase v0.31.0 is pre-installed and available at `/home/user/myproject/pocketbase`.
- **Server Execution**: The script must start the PocketBase server on the default port in the background (so that it responds to `GET http://127.0.0.1:8090/api/health` with HTTP 200) and ensure the server keeps running after the script exits.
- **Superuser Creation**: Create a single superuser record in the `_superusers` collection with email `admin@example.com` and password `Adm1n_passw0rd!`.
- **Collection Schema**: Define a collection named `tasks` (type `base`) with the following fields:
  - `title` (text, required)
  - `done` (bool)
  - `due` (date)
- **Task Seeding**: Seed exactly 5 records in the `tasks` collection with the following exact titles (one record per title, exact case):
  - `Buy groceries`
  - `Walk the dog`
  - `Read a book`
  - `Write weekly report`
  - `Call mom`
- **Idempotency**: Running `bash setup.sh` multiple times must NOT create duplicate superusers or duplicate task records, must not error, and must exit with status 0 each time.

