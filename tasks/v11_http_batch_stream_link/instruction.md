# tRPC v11 Streaming with httpBatchStreamLink

## Background
tRPC v11 introduced `httpBatchStreamLink` and native `AsyncGenerator` support for streaming responses over standard HTTP. This allows for efficient data delivery, such as streaming AI responses.

## Requirements
- Initialize a Node.js project in `/home/user/project`.
- Install tRPC v11 server and client packages, and `@trpc/server/adapters/standalone`.
- Create a tRPC router with a `chatStream` procedure that uses an `AsyncGenerator` to yield three messages: `"hello"`, `"world"`, and `"!"`.
- Create a standalone tRPC server listening on port 3000.
- Create a client script `client.ts` that uses `httpBatchStreamLink` to connect to the server and consumes the `chatStream` procedure, logging each yielded chunk to the console.

## Implementation Guide
1. Create `/home/user/project` and run `npm init -y`.
2. Install `@trpc/server@next`, `@trpc/client@next`, `zod`, and `typescript`.
3. Create `server.ts`:
   - Use `initTRPC.create()`.
   - Define `chatStream` as a `publicProcedure.query` (or `subscription` if appropriate, but `query` works for `AsyncGenerator` streaming in v11 or `subscription` with `httpBatchStreamLink`). Wait, the plan says `AsyncGenerator` Subscriptions: `sub: publicProcedure.subscription(async function* () { yield { status: 'starting' }; })`.
   - Actually, let's use `publicProcedure.subscription` with `httpBatchStreamLink` or `httpSubscriptionLink`? The plan says: `httpBatchStreamLink` enables streaming responses. `AsyncGenerator` Subscriptions use `subscription`. Wait, `httpBatchStreamLink` is for streaming query/mutation responses. Let's use `publicProcedure.query` returning an async generator. 
4. Create `client.ts` that uses `createTRPCClient` with `httpBatchStreamLink` and calls the endpoint.

## Constraints
- Project path: `/home/user/project`
- Start command: `npx tsx server.ts`
- Port: 3000
- Log file: `/home/user/project/client.log`