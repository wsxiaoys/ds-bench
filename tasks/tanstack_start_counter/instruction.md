# TanStack Start Counter App

## Background
Create a full-stack "Counter" app using TanStack Start and Server Functions.

## Requirements
- Initialize a TanStack Start application at `/home/user/project`.
- Implement a counter state on the server.
- Create a Server Function to increment the counter and return the new value.
- The main page (`/`) should display the current count as `Count: 0` initially.
- The main page must contain a button with the exact text `Increment`.
- Clicking the `Increment` button must call the Server Function, increment the counter on the server, and update the UI to display the new count (e.g., `Count: 1`).
- Ensure the app is configured to run on port 8234 and can be started with the command `npm run dev`.

## Implementation Hints
- Use `@tanstack/start` and `@tanstack/react-router`.
- Use `createServerFn` to define the server-side increment logic. The counter state can be kept in an in-memory variable on the server for this simple task.
- Call the server function from the client to interact with it.
- Configure Vite/app to use port 8234.

