# tRPC v11 Context Setup in Next.js App Router

## Background
You need to set up a tRPC v11 backend within a Next.js App Router application. The goal is to correctly configure the context using `fetchRequestHandler` so that procedures can access information about the incoming request, specifically a custom header.

## Requirements
- Initialize a tRPC router with a single procedure `getUser`.
- Configure the tRPC Next.js App Router handler (`app/api/trpc/[trpc]/route.ts`) using `fetchRequestHandler`.
- Implement a `createContext` function that extracts the `x-user-id` header from the incoming request and provides it to the tRPC procedures.
- The `getUser` procedure should return `{ userId: ctx.userId }` where `userId` is the value from the header, or `'anonymous'` if the header is missing.

## Implementation Guide
1. Project path is `/home/user/myproject`.
2. The project is a Next.js application. You need to install `@trpc/server@next`.
3. Create the tRPC initialization in `src/trpc/init.ts`.
4. Create the router in `src/trpc/router.ts`.
5. Create the Next.js API route in `src/app/api/trpc/[trpc]/route.ts`.
6. Implement `createContext` within the API route or a separate file, ensuring it correctly reads headers from the standard `Request` object provided by `fetchRequestHandler`.

## Constraints
- Project path: /home/user/myproject
- Start command: `npm run dev`
- Port: 3000
- Use `@trpc/server@next` for tRPC v11.
- Must use `fetchRequestHandler` for the App Router.