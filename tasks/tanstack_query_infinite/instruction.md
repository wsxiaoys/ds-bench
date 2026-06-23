# TanStack Query Infinite Scrolling Feed

## Background
Implement an infinite scrolling feed using TanStack Query to demonstrate pagination and server state management.

## Requirements
- Initialize a React project with TanStack Query (e.g., Vite + React or TanStack Start) in `/home/user/myproject`.
- Implement a feed that fetches data in pages using `useInfiniteQuery`.
- Create a mock API or server function to serve the feed data. Each page should return a list of items and a `nextCursor`.
- Render the items in a list.
- Add a "Load More" button to fetch the next page.
- Configure the development server to run on port `5123`.

## Implementation Hints
- If using Vite, configure `vite.config.ts` (or equivalent) to use `port: 5123`.
- Use `useInfiniteQuery` from `@tanstack/react-query` to manage the feed state.
- Ensure the mock API can return at least two distinct pages of data to allow pagination testing.

## Acceptance Criteria
- Project path: `/home/user/myproject`
- Start command: `npm run dev`
- Port: `5123`
- Required test criteria that will be evaluated:
  1. The verifier will navigate to `http://localhost:5123/`.
  2. The verifier will check that the initial list of items (Page 1) is rendered.
  3. The verifier will find and click a button with the exact text "Load More".
  4. The verifier will check that the next set of items (Page 2) is appended to the DOM alongside Page 1.

