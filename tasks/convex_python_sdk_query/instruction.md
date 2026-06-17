# Convex Python SDK Integration

## Background
Use the official Python SDK (`convex` package) to interact with a Convex backend. You will set up a simple Convex backend project and write a Python script to perform basic queries and mutations against it.

## Requirements
- Initialize a Convex backend project in `/home/user/myproject`.
- Define a `tasks` table in the schema with `text` (string) and `status` (string).
- Create a mutation `tasks:add` that accepts `text` and `status` arguments and inserts a new task.
- Create a query `tasks:get` that returns all tasks in the table.
- Write a Python script `/home/user/myproject/run.py` using the `convex` PyPI package.
- The Python script must accept `--add <text>` to call the mutation (with `status` defaulting to 'todo' or any valid string), and `--list` to call the query and print the results to stdout.

## Implementation Hints
- Use `npm init -y` and `npm install convex` to set up the Node.js environment for the backend.
- Use `pip install convex` to install the Python SDK.
- You have the `CONVEX_DEPLOY_KEY` environment variable available. You can deploy the backend and run the python script simultaneously using `npx convex deploy --cmd "python3 run.py ..."`. The Convex CLI will automatically inject the `CONVEX_URL` environment variable into the command.
- In `run.py`, initialize the `ConvexClient` using the `CONVEX_URL` environment variable.
- Ensure `run.py` parses arguments correctly and prints the query output when `--list` is used.

## Acceptance Criteria
- Project path: /home/user/myproject
- Command: `npx convex deploy --cmd "python3 run.py <args>"`
- The script must support the `--add <text>` argument to insert a task.
- The script must support the `--list` argument to print the list of tasks to stdout.
- The `run.py` script must connect to the backend using the `CONVEX_URL` environment variable.

