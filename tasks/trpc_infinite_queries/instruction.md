# tRPC v11 Infinite Queries with Suspense

## Background
You have a Next.js App Router application configured with tRPC v11 and React Query v5. The application needs a paginated list of posts. You need to implement the backend procedure and the frontend component using the new `useSuspenseInfiniteQuery` hook.

## Requirements
1. **Backend**: In `server/routers/posts.ts`, implement a `list` procedure under the `posts` router. It should take an input object with `limit` (number, min 1, max 50) and an optional `cursor` (number). It should return a list of posts and a `nextCursor` (number or null if no more posts).
2. **Frontend**: In `app/components/PostList.tsx`, use `trpc.posts.list.useSuspenseInfiniteQuery` to fetch the posts. Display the post titles in an unordered list (`<ul>`).
3. **Load More**: Add a button with the text `Load More` that calls `fetchNextPage()` when clicked. The button should be disabled if `!hasNextPage` or `isFetchingNextPage`.

## Implementation Guide
1. Update `server/routers/posts.ts` to implement the `list` procedure. You can use the provided `mockPosts` array.
2. Update `app/components/PostList.tsx` to use `useSuspenseInfiniteQuery` and render the list and the "Load More" button.

## Constraints
- Project path: `/home/user/project`
- Start command: `npm run dev`
- Port: `3000`
- Use `zod` for input validation.
- The cursor should be the index of the next item to fetch. E.g., if `cursor` is 0 and `limit` is 2, return items at index 0 and 1, and `nextCursor` should be 2.