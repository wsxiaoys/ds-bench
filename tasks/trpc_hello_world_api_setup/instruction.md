# tRPC v11 Hello World API

## Background
Set up a basic typesafe API using tRPC v11 within a Next.js App Router application. The API should have a "Hello World" endpoint that takes an input string and returns a greeting, which is then called from a Client Component.

## Requirements
- Initialize a Next.js App Router project.
- Install tRPC v11 and its dependencies (`@trpc/server@next`, `@trpc/client@next`, `@trpc/react-query@next`, `@tanstack/react-query@latest`, `zod`).
- Create a tRPC router with a single `hello` query procedure that accepts a string input and returns `"Hello ${input}"`.
- Expose the API using Next.js App Router Route Handlers (`app/api/trpc/[trpc]/route.ts`).
- Create a tRPC React Query client and provide it to the application.
- Create a Client Component (`app/page.tsx`) that calls the `hello` endpoint with the input "World" and displays the result.

## Implementation Guide
1. Initialize a Next.js project in `/home/user/project`.
2. Install required dependencies.
3. Create `server/trpc.ts` to initialize tRPC using `initTRPC.create()`.
4. Create `server/routers/_app.ts` to define the `appRouter` with the `hello` procedure using `zod` for input validation.
5. Create the API route in `app/api/trpc/[trpc]/route.ts` using `fetchRequestHandler`.
6. Set up the tRPC client in `utils/trpc.ts` using `createTRPCReact`.
7. Create a provider component in `app/Provider.tsx` that sets up `QueryClient` and `trpc.Provider` with `httpBatchLink` pointing to `/api/trpc`.
8. Wrap the `app/layout.tsx` children with the `Provider`.
9. Update `app/page.tsx` to be a Client Component (`"use client"`) and use `trpc.hello.useQuery('World')` to fetch and display the greeting.

## Constraints
- Project path: `/home/user/project`
- Start command: `npm run dev`
- Port: 3000
- Must use tRPC v11 (`@next`) and TanStack React Query v5.

## Integrations
- None