# tRPC Standalone Server with CORS

## Background
Configure CORS correctly for a standalone tRPC server using tRPC v11.

## Requirements
- Create a standalone tRPC server using `@trpc/server/adapters/standalone`.
- Implement a simple `hello` query that returns a greeting.
- Configure CORS to allow requests from `http://127.0.0.1:3000`.

## Implementation Guide
1. Initialize a Node.js project in `/home/user/project`.
2. Install `@trpc/server@next`, `zod`, and `cors`.
3. Create an `index.ts` file that sets up the tRPC router with a `hello` query.
4. Use `createHTTPServer` from `@trpc/server/adapters/standalone` and apply the `cors` middleware. Ensure the server listens on port 4000 and can be started via `npx tsx index.ts`.
