# tRPC v11 Basic Streaming Setup

## Background
In tRPC v11, you can use `httpBatchStreamLink` combined with `AsyncGenerator` procedures to stream data from the server to the client over standard HTTP. This is useful for progressively loading data or streaming AI responses.

## Requirements
- There is a Next.js App Router project located at `/home/user/app`.
- The tRPC v11 packages (`@trpc/server@next`, `@trpc/client@next`, `@trpc/react-query@next`, `@tanstack/react-query@latest`) are already installed.
- You must create a tRPC router with a `streamNumbers` query procedure that takes no input and returns an `AsyncGenerator` yielding the numbers 1, 2, and 3, with a 50ms delay between each.
- Configure the tRPC client to use `httpBatchStreamLink` instead of `httpBatchLink`.
- In `app/page.tsx`, create a client component that calls `streamNumbers` and displays the yielded numbers in a `div` with id `stream-output`. The output should be a comma-separated string (e.g., `1, 2, 3`).

## Constraints
- **Project path**: `/home/user/app`
- **Start command**: `npm run build && npm start`
- **Port**: 3000
- Use `httpBatchStreamLink` for the client.