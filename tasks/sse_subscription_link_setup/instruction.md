# tRPC v11 SSE Subscriptions

## Background
tRPC v11 introduces native support for Server-Sent Events (SSE) subscriptions using async generators, removing the strict requirement for WebSockets.

## Requirements
Implement a tRPC server with a subscription procedure and a client that consumes it.

## Implementation Guide
1. Project path: `/home/user/project`
2. In `server.ts`, create a tRPC router with a `countdown` subscription procedure. It should take an input number (using `zod` to validate `z.number()`).
3. The `countdown` procedure must use an `async function*` generator to yield numbers counting down from the input to 0 (inclusive), with a 100ms delay between each yield.
4. Serve the router using `@trpc/server/adapters/standalone` on port 3000.
5. In `client.ts`, create a tRPC client using `createTRPCClient` and `httpSubscriptionLink` (or `unstable_httpSubscriptionLink` depending on the version).
6. The client should connect to `http://localhost:3000`, call the `countdown` subscription with input `3`, and collect the yielded values into an array.
7. When the subscription completes, the client must write the JSON array of numbers to `/home/user/project/output.json`.

## Constraints
- Project path: `/home/user/project`
- Server must listen on port 3000.
- Use `npm start` to run the server in the background, and `npm run client` to execute the client script.