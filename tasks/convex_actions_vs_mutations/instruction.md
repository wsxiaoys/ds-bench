# Convex Actions vs Mutations

## Background
You are working on a Convex project that manages a list of tasks. There is a feature intended to fetch a sample todo item from an external API (`https://jsonplaceholder.typicode.com/todos/1`) and save it to the database. However, the current implementation attempts to perform this `fetch` inside a `mutation`. In Convex, mutations must be deterministic and cannot have side effects like calling external APIs, so this code fails.

## Requirements
- Fix the bug by refactoring the code to respect Convex's separation of Actions and Mutations.
- Create an `action` named `fetchAndSave` in `convex/tasks.ts` that fetches data from `https://jsonplaceholder.typicode.com/todos/1`.
- The action must parse the JSON response, extract the `title` field, and then call a `mutation` named `saveTask` to insert the title into the `tasks` table with `isCompleted: false`.
- The `fetchAndSave` action should not take any arguments and must return the ID of the newly created task.
- Ensure the `saveTask` mutation is properly defined to accept the `title` and insert the record.

## Implementation Hints
- Read about Actions vs Mutations in the Convex documentation. Actions can perform side effects like `fetch`, while mutations cannot.
- Use `ctx.runMutation` inside the action to call the mutation and save the data to the database.
- Remember to export both the action and the mutation so they are accessible.

## Acceptance Criteria
- Project path: /home/user/project
- Ensure the code can be successfully deployed to Convex.
- The Convex backend must expose an action `tasks:fetchAndSave`.
- When the `tasks:fetchAndSave` action is called, it should successfully fetch the external API, save the task via a mutation, and return a valid document ID.
- The database `tasks` table should contain the newly inserted task with the title fetched from the external API and `isCompleted` set to `false`.
