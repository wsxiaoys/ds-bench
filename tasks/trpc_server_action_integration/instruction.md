# tRPC v11 with Next.js Server Actions

## Background
Integrate tRPC v11 with Next.js Server Actions to securely call backend procedures from the server.

## Requirements
- Initialize a Next.js project in `/home/user/project`.
- Install tRPC v11 and necessary dependencies.
- Define a tRPC router with an `addMessage` mutation that takes a string `text` and returns an object `{ success: true, message: text }`.
- Create a Next.js Server Action that uses `createCallerFactory` to call the `addMessage` mutation.
- Create a Client Component with a form that calls the Server Action when submitted, and displays the result.

## Implementation Guide
1. Run `npx create-next-app@latest /home/user/project --typescript --tailwind --eslint --app --use-npm --src-dir --import-alias "@/*"` to create the project.
2. Install `@trpc/server@next`, `@trpc/client@next`, `@trpc/react-query@next`, `@tanstack/react-query@latest`, `zod`, and `superjson`.
3. Create the tRPC router in `src/server/trpc.ts` or similar, defining the `addMessage` mutation using `zod` for input validation.
4. Export a server-side caller using `createCallerFactory`.
5. Create a Server Action in `src/app/actions.ts` that imports the caller and executes `addMessage`.
6. Update `src/app/page.tsx` to include a form that triggers the Server Action and displays the returned message.

## Constraints
- Project path: `/home/user/project`
- Start command: `npm run dev`
- Port: 3000
- Must use `createCallerFactory` for the server-side caller.
- Must use Next.js App Router.