# Collaborative Counter with React and Convex

## Background
Create a collaborative counter where multiple clients see updates instantly using React and Convex.

## Requirements
- Create a React application using Vite in `/home/user/myproject` and configure it to use Convex.
- Implement a shared counter that users can increment. The UI must feature a button with the exact text "Increment" that increments the count when clicked.
- The counter state must be stored in Convex.
- The UI must update reactively when the counter is incremented.
- The application must run on port `5173` (accessible at `http://localhost:5173`) using `npm run dev`.
- To prevent cross-run conflicts, you **MUST** isolate the counter data using the `run-id` from `/logs/artifacts/run-id`. Store the `run-id` in the counter document and filter by it in your queries and mutations.

## Implementation Hints
- Use `npm create vite@latest` to scaffold the React app in `/home/user/myproject`.
- Install the `convex` package and initialize it.
- Define a schema with a `counters` table that includes a `runId` field and a `count` field.
- Write a query to fetch the counter by `runId` and a mutation to increment it (or create it if it doesn't exist).
- Expose the `/logs/artifacts/run-id` to your Vite app (e.g., by passing it as `VITE_RUN_ID` during the build or dev process) so the React components can use it.
- Deploy the Convex functions using `npx convex deploy`. You will need to use the `CONVEX_DEPLOY_KEY` and `CONVEX_URL` environment variables provided to you.

