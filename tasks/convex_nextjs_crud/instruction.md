# Convex Next.js Task Manager

## Background
Create a basic CRUD task manager application using Next.js and Convex as the backend.

## Requirements
- Initialize a Next.js application and set up Convex.
- Define a Convex schema for a `tasks` table. Each task should have `text` (string), `isCompleted` (boolean), and `runId` (string).
- To support parallel testing, every task in the database MUST include a `runId` field, populated from the `NEXT_PUBLIC_ZEALT_RUN_ID` environment variable (which you must pass from `ZEALT_RUN_ID`).
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
- Ensure you read `ZEALT_RUN_ID` and expose it to the frontend via `NEXT_PUBLIC_ZEALT_RUN_ID` so the client can filter and create tasks with the correct `runId`.
- Pass `CONVEX_URL` to `NEXT_PUBLIC_CONVEX_URL` for the frontend.
- Provide a form to add tasks, and buttons/checkboxes to toggle and delete them.
- Add `data-testid` attributes to key elements (e.g., `task-input`, `add-button`, `task-item`, `toggle-button`, `delete-button`) to make browser verification easier.

## Acceptance Criteria
- Project path: /home/user/task-manager
- Start command: npm run dev
- Port: 3000
- Web Features:
  - The root page (`/`) should load successfully.
  - Users can enter text into an input field (identified by `data-testid="task-input"`) and click a button (identified by `data-testid="add-button"`) to add a new task.
  - The new task appears in the list (identified by `data-testid="task-item"`).
  - Users can click a button or checkbox on a task (identified by `data-testid="toggle-button"`) to mark it as completed.
  - Users can click a button on a task (identified by `data-testid="delete-button"`) to remove it from the list.
  - Tasks created with a specific `runId` are not visible when the app is run with a different `runId`.
