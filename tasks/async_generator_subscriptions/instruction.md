# tRPC v11 AsyncGenerator Subscriptions

## Background
Implement a real-time subscription using tRPC v11's new `AsyncGenerator` support and Server-Sent Events (SSE).

## Requirements
- Create a tRPC server in `/home/user/project/server.ts` that exposes a `countdown` subscription procedure.
- The `countdown` procedure should take a number as input and yield numbers counting down to 0, with a 100ms delay between each yield.
- Create a tRPC client in `/home/user/project/client.ts` that connects to the server using `httpSubscriptionLink`.
- The client should call the `countdown` subscription with an input of 3 and print the received numbers to standard output.

## Constraints
- Project path: `/home/user/project`
- Port: 3000
- Log file: `/home/user/project/output.log`