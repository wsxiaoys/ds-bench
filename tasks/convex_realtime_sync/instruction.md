# Collaborative Counter with React and Convex

## Background
Create a collaborative counter where multiple clients see updates instantly using React and Convex.

## Requirements
- Create a React application using Vite and configure it to use Convex.
- Implement a shared counter that users can increment.
- The counter state must be stored in Convex.
- The UI must update reactively when the counter is incremented.
- To prevent cross-trial conflicts, you **MUST** isolate the counter data using the `run-id` from the `ZEALT_RUN_ID` environment variable. Store the `run-id` in the counter document and filter by it in your queries and mutations.

## Implementation Hints
- Use `npm create vite@latest` to scaffold the React app.
- Install the `convex` package and initialize it.
- Define a schema with a `counters` table that includes a `runId` field and a `count` field.
- Write a query to fetch the counter by `runId` and a mutation to increment it (or create it if it doesn't exist).
- Expose the `ZEALT_RUN_ID` to your Vite app (e.g., by passing it as `VITE_RUN_ID` during the build or dev process) so the React components can use it.
- Deploy the Convex functions using `npx convex deploy`. You will need to use the `CONVEX_DEPLOY_KEY` and `CONVEX_URL` environment variables provided to you.

## Acceptance Criteria
- Project path: /home/user/myproject
- Start command: npm run dev
- Port: 5173
- The React app must be accessible at `http://localhost:5173`.
- The app must display the current count for the specific `run-id`.
- The app must have a button with the text "Increment" that increments the count when clicked.
- The counter data must be stored in Convex and isolated by `run-id` (read from `ZEALT_RUN_ID`).

