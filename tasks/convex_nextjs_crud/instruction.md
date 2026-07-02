# Convex Next.js Task Manager

## Background
Create a basic CRUD task manager application using Next.js and Convex as the backend.

## Requirements
- Initialize a Next.js application inside `/home/user/task-manager` and set up Convex.
- The application must run on port `3000` using the start command `npm run dev`.
- Define a Convex schema for a `tasks` table. Each task should have `text` (string), `isCompleted` (boolean), and `runId` (string).
- To support parallel testing, every task in the database MUST include a `runId` field, populated from the `NEXT_PUBLIC_`/logs/artifacts/run-id`` environment variable (which you must pass from `/logs/artifacts/run-id`).
- The UI must ONLY display tasks that match the current `runId`.
- Implement functionality to:
  - List tasks (filtered by `runId`).
  - Add a new task (with the current `runId`).
  - Toggle the `isCompleted` status of a task.
  - Delete a task.
- The UI should be accessible via a web browser.

## Implementation Hints
- Use `npx create-next-app@latest` to initialize the project, then `npm install convex`.
- Set up a Convex provider in the Next.js app.
- Define `tasks` in `convex/schema.ts` with `text`, `isCompleted`, and `runId`.
- Write queries and mutations in `convex/tasks.ts`.
- Ensure you read `/logs/artifacts/run-id` and expose it to the frontend via `NEXT_PUBLIC_`/logs/artifacts/run-id`` so the client can filter and create tasks with the correct `runId`.
- Pass `CONVEX_URL` to `NEXT_PUBLIC_CONVEX_URL` for the frontend.
- Provide a form to add tasks, and buttons/checkboxes to toggle and delete them.
- Add the following `data-testid` attributes to key elements: `task-input` (for the input field), `add-button` (for the submit/add button), `task-item` (for each task list item), `toggle-button` (for the checkbox or button to toggle status), and `delete-button` (for the button to delete a task) to make browser verification succeed.
