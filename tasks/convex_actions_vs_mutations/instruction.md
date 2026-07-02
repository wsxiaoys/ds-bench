# Convex Actions vs Mutations

## Background
You are working on a Convex project located at `/home/user/project` that manages a list of tasks. There is a feature intended to fetch a sample todo item from an external API (`https://jsonplaceholder.typicode.com/todos/1`) and save it to the database. However, the current implementation attempts to perform this `fetch` inside a `mutation`. In Convex, mutations must be deterministic and cannot have side effects like calling external APIs, so this code fails.

## Requirements
- Fix the bug by refactoring the code to respect Convex's separation of Actions and Mutations.
- To keep the data isolated across concurrent and repeated runs (the same Convex deployment is reused), the destination table MUST be named uniquely per run:
  - Read the run id from `/logs/artifacts/run-id` (trim surrounding whitespace).
  - Build a safe suffix by replacing every character that is not a letter or digit (for example hyphens) with an underscore.
  - Name the table `tasks_<suffix>`.
  - Convex table names may only contain letters, digits, and underscores, must start with a letter, and must be at most 64 characters long. If `tasks_<suffix>` would exceed 64 characters, truncate the suffix so the final table name stays within the limit.
- Define the schema for the `tasks_<suffix>` table in `convex/schema.ts` with the fields `title` (string) and `isCompleted` (boolean).
- Create an `action` named `fetchAndSave` in `convex/tasks.ts` that fetches data from `https://jsonplaceholder.typicode.com/todos/1`.
- The action must parse the JSON response, extract the `title` field, and then call a `mutation` named `saveTask` to insert the title into the `tasks_<suffix>` table with `isCompleted: false`.
- The `fetchAndSave` action should not take any arguments and must return the ID of the newly created task.
- Ensure the `saveTask` mutation is properly defined to accept the `title` and insert the record into the `tasks_<suffix>` table.

## Implementation Hints
- Read about Actions vs Mutations in the Convex documentation. Actions can perform side effects like `fetch`, while mutations cannot.
- Use `ctx.runMutation` inside the action to call the mutation and save the data to the database.
- Remember to export both the action and the mutation so they are accessible.
- Read `/logs/artifacts/run-id` when building both `convex/schema.ts` and `convex/tasks.ts` so the table name is derived consistently from the run id (and stays within Convex's 64-character table-name limit).
