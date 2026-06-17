# Convex React CRUD App

## Background
Convex is a reactive backend-as-a-service (BaaS) that provides a real-time database, serverless functions, and cloud infrastructure. Create a basic Task Manager CRUD app using React and Convex to demonstrate data synchronization, schema validation, and indexes.

## Requirements
- Create a React application with Vite (using the `react-ts` template) in the `/home/user/my-app` directory.
- Configure the Convex client using the `CONVEX_URL` environment variable (set as `VITE_CONVEX_URL`).
- Define a Convex schema for a `tasks` table with the following fields:
  - `text` (string)
  - `status` (string literal union: "todo" or "done")
  - `runId` (string) - used to isolate data across concurrent test runs.
- Create an index named `by_run_id_and_status` on `["runId", "status"]`.
- Implement Convex functions (queries/mutations) to:
  - Fetch all tasks for a specific `runId`, optionally filtered by `status` (using the `by_run_id_and_status` index).
  - Add a new task (defaults to "todo" and sets the `runId`).
  - Update a task's status.
  - Delete a task.
- Build a React UI to interact with these functions.
- The UI MUST pass the `ZEALT_RUN_ID` environment variable to the backend functions to ensure data isolation.
- Deploy the Convex backend using `npx convex deploy` (which uses the `CONVEX_DEPLOY_KEY` environment variable).

## Implementation Hints
- Use `npm create vite@latest my-app -- --template react-ts` to scaffold the project.
- Install `convex` and use `npx convex deploy` to push the backend schema and functions to the cloud.
- Define your schema in `convex/schema.ts` using `defineSchema` and `defineTable`.
- Write your queries and mutations in `convex/tasks.ts`. Ensure they accept `runId` as an argument.
- In your React app, wrap the root with `ConvexProvider` and pass a `ConvexReactClient` initialized with `import.meta.env.VITE_CONVEX_URL`.
- Use Convex React hooks (`useQuery`, `useMutation`) in your components to read and write data.
- Expose the `ZEALT_RUN_ID` to your Vite React app by prefixing it as `VITE_ZEALT_RUN_ID` in your `.env` or passing it during the build/dev process.

## Acceptance Criteria
- Project path: /home/user/my-app
- Start command: npm run dev
- Port: 5173
- The Convex backend must be successfully deployed (schema and functions pushed to the cloud).
- The React app should be running and accessible on port 5173.
- UI features (Browser verification):
  - The page displays a list of tasks for the current `runId`.
  - There is a text input field and a submit button to add a new task.
  - Each task has a toggle/button to change its status between "todo" and "done".
  - Each task has a delete button.
- Convex Backend features:
  - The `tasks` table schema enforces `text` (string), `status` (union: "todo", "done"), and `runId` (string).
  - The `tasks` table has an index `by_run_id_and_status` on `["runId", "status"]`.

