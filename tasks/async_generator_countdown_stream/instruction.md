# tRPC v11 AsyncGenerator Subscription

## Background
tRPC v11 introduces support for native `AsyncGenerator` functions in subscriptions, allowing you to stream data over Server-Sent Events (SSE) using the new `httpSubscriptionLink` without needing a WebSocket server.

## Requirements
- Implement a tRPC v11 server that exposes a `countdown` subscription procedure.
- The procedure should take a number `n` as input and yield numbers from `n` down to 0, with a 100ms delay between each yield using an `AsyncGenerator`.
- Implement a client script that uses `httpSubscriptionLink` (or `unstable_httpSubscriptionLink` depending on the exact v11 version exported) to connect to the server and collect the streamed numbers.

## Implementation Guide
1. The project is located at `/home/user/project` and dependencies are already installed.
2. In `server.ts`, create a tRPC router with a `countdown` subscription using `publicProcedure.subscription(async function* (opts) { ... })`. Use `@trpc/server/adapters/standalone` to serve it on port 3000.
3. In `client.ts`, create a tRPC client using `createTRPCClient` and `httpSubscriptionLink` (or `unstable_httpSubscriptionLink`). Call the `countdown` subscription with input `5`, collect the yielded values into an array, and when the stream is complete, write the final array as JSON to `/home/user/project/output.json`.

## Constraints
- Project path: `/home/user/project`
- The server must run on port 3000.
- The client must write the exact JSON array to `/home/user/project/output.json`.