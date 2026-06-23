# Migrate tRPC v10 to v11

## Background
You have a Next.js project using tRPC v10. You need to migrate it to tRPC v11.

## Requirements
- Upgrade `@trpc/server`, `@trpc/client`, `@trpc/react-query`, and `@trpc/next` to `@next`.
- Upgrade `@tanstack/react-query` to `latest`.
- Fix the client-side transformer configuration (move it into the links array).
- Fix the `createContext` function in the server to use `info.calls[0].getRawInput()` instead of the removed `req.body` or similar if applicable, or just ensure the server runs without type errors regarding `TRPCRequestInfo`.

## Constraints
- Project path: `/home/user/project`
- Start command: `npm run dev`
- Port: 3000