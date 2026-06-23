# Standalone tRPC Server Setup

## Background
Set up a standalone tRPC server using `@trpc/server/adapters/standalone` and `zod` for input validation.

## Requirements
- Initialize a Node.js project in `/home/user/project`.
- Install `@trpc/server@next`, `zod`, `typescript`, `ts-node`, and `@types/node`.
- Create a `server.ts` file that sets up a tRPC router with a `greet` procedure. The procedure should accept an input object `{ name: string }` and return `{ greeting: "Hello, " + name }`.
- Create a standalone server listening on port 3000 using `createHTTPServer` from `@trpc/server/adapters/standalone`.

## Implementation Guide
1. Initialize a Node.js project in `/home/user/project`.
2. Install the required dependencies: `@trpc/server@next`, `zod`, `typescript`, `ts-node`, and `@types/node`.
3. Create `server.ts` and implement the tRPC router and the standalone server.
4. Ensure the server listens on port 3000.

## Constraints
- Project path: /home/user/project
- Start command: npx ts-node server.ts
- Port: 3000