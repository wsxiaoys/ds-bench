# tRPC v11 AsyncGenerator Subscriptions

## Background
Implement a real-time subscription using tRPC v11's new `AsyncGenerator` support and Server-Sent Events (SSE).

## Requirements
- Create a tRPC server in `/home/user/project/server.ts` that exposes a `countdown` subscription procedure.
- The `countdown` procedure should take a number as input and yield numbers counting down to 0, with a 100ms delay between each yield. You must implement the subscription procedure using an async generator function (declared using `async function*` or `async function *`).
- Create a tRPC client in `/home/user/project/client.ts` that connects to the server using `httpSubscriptionLink`.
- The client should call the `countdown` subscription with an input of 3, print the received numbers to standard output, and save/redirect this output to `/home/user/project/output.log`.

## Constraints
- Project path: `/home/user/project`
- Port: 3000
- Log file: `/home/user/project/output.log`