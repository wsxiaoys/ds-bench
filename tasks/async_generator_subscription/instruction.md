# AsyncGenerator Subscription in tRPC v11

## Background
In tRPC v11, subscriptions now use native async generators instead of the old observable pattern.

## Requirements
You have a basic tRPC v11 server in `/home/user/project/server.ts`.
Implement a subscription procedure named `countdown` that yields numbers from 3 down to 1 using an `async function*`.
The server is already set up to serve subscriptions over HTTP using SSE, you just need to update the `countdown` procedure in the router.

## Implementation
1. Edit `/home/user/project/server.ts`.
2. Find the `appRouter` definition.
3. Add a `countdown` procedure using `publicProcedure.subscription(async function* () { ... })`.
4. Yield the numbers 3, 2, and 1, in that order.
5. You can use a small delay (e.g., `await new Promise(r => setTimeout(r, 100))`) between yields.

## Constraints
- Project path: `/home/user/project`
- Log file: `/home/user/project/output.log`