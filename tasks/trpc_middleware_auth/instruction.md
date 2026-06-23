# tRPC v11 Authentication Middleware

## Background
You need to implement an authentication middleware using tRPC v11 context. You have a basic tRPC v11 standalone server setup in `/home/user/project`.

## Requirements
- Implement a `createContext` function that reads the `authorization` header from the incoming request.
- If the `authorization` header is exactly `Bearer mysecrettoken`, set `user: { id: 1, name: 'Admin' }` in the context. Otherwise, `user` should be `null`.
- Create a middleware `isAuthed` that checks if `ctx.user` exists. If not, it must throw a `TRPCError` with the code `UNAUTHORIZED`.
- Create a `protectedProcedure` using the `isAuthed` middleware.
- Define a router `appRouter` with a `secretData` query using `protectedProcedure`. The query should return `{ secret: "super secret" }`.
- Start the standalone server on port 3000.

## Implementation Guide
1. Open `/home/user/project/server.ts`.
2. Implement the `createContext` function to parse the `authorization` header from `req.headers`.
3. Create the `isAuthed` middleware using `t.middleware`.
4. Create `protectedProcedure` by chaining `t.procedure.use(isAuthed)`.
5. Add the `secretData` query to `appRouter`.
6. The server is already configured to start on port 3000 using `createHTTPServer`.

## Constraints
- Project path: `/home/user/project`
- Start command: `npm run start`
- Port: 3000
- Must use tRPC v11 `@trpc/server@next`.