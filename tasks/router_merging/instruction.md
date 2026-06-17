# Merge tRPC Routers

## Background
We are using tRPC v11 in a Next.js project. The application has grown, and the API has been split into multiple sub-routers (`userRouter` and `postRouter`). These sub-routers need to be merged into a single root `appRouter` so they can be served from a single API endpoint and their types can be shared with the client.

## Requirements
- Merge `userRouter` and `postRouter` into a single `appRouter` under the namespaces `user` and `post` respectively.
- Export the `AppRouter` type so the client can use it.
- Configure the Next.js API route to serve the merged `appRouter`.

## Implementation Guide
1. Open `src/server/routers/_app.ts`.
2. Import `router` from `src/server/trpc.ts`.
3. Import `userRouter` from `./user.ts` and `postRouter` from `./post.ts`.
4. Create `appRouter` using `router({ user: userRouter, post: postRouter })`.
5. Export `appRouter` and its type `AppRouter`.
6. Open `src/app/api/trpc/[trpc]/route.ts`.
7. Import `appRouter` from `src/server/routers/_app.ts`.
8. Pass `appRouter` to the `router` option in `fetchRequestHandler`.

## Constraints
- Project path: `/home/user/project`
- Start command: `npm run dev`
- Port: 3000
- You must use the `router` function from `src/server/trpc.ts` to merge the routers (do not use the deprecated `mergeRouters` function unless necessary, but namespacing via `router()` is preferred).
