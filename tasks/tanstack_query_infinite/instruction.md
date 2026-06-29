# TanStack Query Infinite Scrolling Feed

## Background
Implement an infinite scrolling feed using TanStack Query to demonstrate pagination and server state management.

## Requirements
- Initialize a React project with TanStack Query (e.g., Vite + React or TanStack Start) in `/home/user/myproject`.
- Implement a feed that fetches data in pages using `useInfiniteQuery`.
- Create a mock API or server function to serve the feed data. Each page should return a list of items and a `nextCursor`.
- Render the items in a list.
- Add a button with the exact text "Load More" to fetch the next page. When clicked, the next set of items should be fetched and appended to the list, retaining the existing items.
- Configure the development server to run on port `5123` using the start command `npm run dev`.

## Implementation Hints
- If using Vite, configure `vite.config.ts` (or equivalent) to use `port: 5123`.
- Use `useInfiniteQuery` from `@tanstack/react-query` to manage the feed state.
- Ensure the mock API can return at least two distinct pages of data to allow pagination testing.

