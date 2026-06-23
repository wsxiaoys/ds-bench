# tRPC v11 Setup in Next.js App Router

## Background
You have a basic Next.js App Router project at `/home/user/myproject`. You need to set up a tRPC v11 backend API and call it from a client component.

## Requirements
- Initialize a tRPC v11 router with a `hello` query that takes a string input and returns `"Hello <input>"`.
- Expose the API at `/api/trpc/[trpc]` using Next.js App Router's `fetchRequestHandler`.
- Create a tRPC React Query client and a Provider component.
- Update `src/app/page.tsx` (a Client Component) to call the `hello` query with input `"tRPC v11"` and display the result.

## Implementation Guide
1. The project is at `/home/user/myproject`.
2. Install `@trpc/server@next @trpc/client@next @trpc/react-query@next @tanstack/react-query@latest zod`.
3. Create `src/server/trpc.ts`:
```ts
import { initTRPC } from '@trpc/server';
export const t = initTRPC.create();
export const router = t.router;
export const publicProcedure = t.procedure;
```
4. Create `src/server/routers/_app.ts`:
```ts
import { z } from 'zod';
import { router, publicProcedure } from '../trpc';
export const appRouter = router({
  hello: publicProcedure.input(z.string()).query(({ input }) => `Hello ${input}`),
});
export type AppRouter = typeof appRouter;
```
5. Create `src/app/api/trpc/[trpc]/route.ts` using `fetchRequestHandler` from `@trpc/server/adapters/fetch`.
6. Create a client provider in `src/app/Provider.tsx` using `createTRPCReact` and wrap the app in `src/app/layout.tsx`.
7. Update `src/app/page.tsx` to use the `hello` query and render the result inside a `<div id="result">` element.

## Constraints
- Project path: `/home/user/myproject`
- Start command: `npm run dev`
- Port: 3000