# Migrate tRPC v10 to v11

## Background
You have a basic Node.js tRPC server and a client script at `/home/user/project` that currently uses tRPC v10. The project uses `superjson` for data transformation. You need to upgrade the project to tRPC v11.

## Requirements
1. Upgrade `@trpc/server` and `@trpc/client` to the `next` version (v11).
2. Update the client initialization in `client.ts` to correctly configure the `superjson` transformer according to v11 requirements (moving it into the `links` array, specifically inside `httpBatchLink`).
3. Ensure the client can successfully call the server and receive the transformed data.

## Constraints
- Project path: `/home/user/project`
- The server runs on port 3000.
- The client script should output a successful response containing a Date object.