# Encore REST API with PostgreSQL in Go

## Background
Create a REST API with a PostgreSQL database for managing a list of tasks (To-Do items) using Encore and Go, and deploy it to Encore Cloud.

## Requirements
- Initialize a new Encore application named `taskmanager` using Go.
- Create a service named `task` with a PostgreSQL database named `taskdb`.
- Implement a RESTful API with the following endpoints in the `task` service:
  - POST `/tasks`: Create a new task (fields: `title`, `description`). The task should default to `done: false`.
  - GET `/tasks`: List all tasks.
  - GET `/tasks/:id`: Get a single task by its integer ID.
  - PUT `/tasks/:id`: Update a task's `title`, `description`, and `done` status.
  - DELETE `/tasks/:id`: Delete a task by ID.
- Add a database migration file to create the `tasks` table with columns `id` (serial primary key), `title` (text), `description` (text), and `done` (boolean).
- Deploy the application to Encore Cloud.

## Implementation Hints
- Read the `ENCORE_AUTH_TOKEN_JSON` environment variable to authenticate with Encore Cloud.
- A simple guide to deploy an Encore app to Encore Cloud:
  1. Run `mkdir -p ~/.config/encore && printf '%s' "$ENCORE_AUTH_TOKEN_JSON" > ~/.config/encore/.auth_token`.
  2. Run `encore auth whoami` to confirm authentication.
  3. Initialize an Encore app: `encore app init taskmanager --lang go`.
  4. Go into the app directory: `cd taskmanager`.
  5. Initialize a Git repository: `git init`.
  6. Add the Encore Git remote: `git remote add encore encore://<app-id>` (extract `<app-id>` from the `encore.app` file).
  7. Commit your code: `git add . && git commit -m "initial"`.
  8. Push to the Encore remote and wait for deployment: `git push encore`.
- Use `encore.dev/storage/sqldb` to define the database and query it.
- The task executor is expected to deploy the app to Encore Cloud. Docker is NOT available in the task execution environment, so `encore run` will not work.

## Acceptance Criteria
- Project path: /home/user/taskmanager
- Ensure the application is successfully deployed to Encore Cloud.
- The API endpoints must be accessible at the deployed endpoint: `https://staging-<app-id>.encr.app`.
- API Endpoints:
  - POST `/tasks`: Accepts JSON `{"title": string, "description": string}` and returns 200 OK with the created task JSON `{"id": number, "title": string, "description": string, "done": boolean}`.
  - GET `/tasks`: Returns 200 OK and a JSON object containing an array of tasks: `{"tasks": [{"id": number, "title": string, "description": string, "done": boolean}]}`.
  - GET `/tasks/:id`: Returns 200 OK with the task JSON.
  - PUT `/tasks/:id`: Accepts JSON `{"title": string, "description": string, "done": boolean}` and returns 200 OK with the updated task JSON.
  - DELETE `/tasks/:id`: Deletes the task and returns 200 OK.

