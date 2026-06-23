# tRPC v11 Next.js App Router Data Fetching

## Background
In tRPC v11, `createCallerFactory` replaces the old `createCaller` to execute procedures on the server (e.g., in React Server Components). You need to set up a Next.js App Router project that fetches initial data on the server and provides client-side interactivity using React Query.

## Requirements
- A Next.js App Router project is located at `/home/user/app`.
- The tRPC router is defined in `src/server/trpc.ts` with a `hello` query that takes a `name` string and returns `Hello ${name}`.
- Use `createCallerFactory` to create a server-side caller in `src/server/caller.ts`.
- In the Server Component `src/app/page.tsx`, use the caller to fetch `hello({ name: 'Server' })` and render it inside an `<h1>` tag with id `server-data`.
- Provide a client component `src/app/ClientComponent.tsx` that uses `trpc.hello.useQuery({ name: 'Client' })` and renders it inside a `<p>` tag with id `client-data`.

## Implementation Guide
1. Modify `src/server/caller.ts` to export a `caller` created using `createCallerFactory`.
2. Update `src/app/page.tsx` to be an async Server Component, fetch data using the caller, and render it. Also, include `<ClientComponent />`.
3. Update `src/app/ClientComponent.tsx` to use the tRPC React Query hook.

## Constraints
- Project path: `/home/user/app`
- Start command: `npm run build && npm start`
- Port: 3000