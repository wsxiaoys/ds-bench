# tRPC v11 SSE Subscription

## Background
tRPC v11 introduced native support for Server-Sent Events (SSE) subscriptions, replacing the strict need for WebSockets. You will implement a simple SSE subscription using `httpSubscriptionLink` on the client and an async generator on the server.

## Requirements
- A tRPC server using Express adapter.
- A `countdown` subscription procedure that yields numbers from 5 down to 1, with a 100ms delay between each yield, and then returns.
- A tRPC client using `@trpc/client` that connects to the server and listens to the `countdown` subscription.
- The client should collect the yielded numbers into an array and save them to a file `/home/user/project/output.json` as a JSON array (e.g., `[5, 4, 3, 2, 1]`) and exit the process.
- You may need to ponyfill `EventSource` in the client since Node.js doesn't have it natively. You can use the `eventsource` package (already installed) and pass it to `httpSubscriptionLink({ url: '...', EventSource: require('eventsource') })`.

## Constraints
- Project path: `/home/user/project`
- Port: 3000
- Log file: `/home/user/project/output.log`