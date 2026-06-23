# tRPC v11 Streaming Response Setup

## Background
tRPC v11 introduces native support for streaming responses using `AsyncGenerator` and `httpBatchStreamLink`. You need to implement a streaming endpoint that yields a sequence of words and display them in a Next.js client component.

## Requirements
- Set up a Next.js App Router project at `/home/user/project`.
- Install tRPC v11 (`@trpc/server@next`, `@trpc/client@next`, `@trpc/react-query@next`, `@tanstack/react-query@latest`) and `zod`.
- Create a tRPC router with a `streamWords` public procedure that uses an `async function*` to yield the words "Hello", "streaming", "world" with a small delay (e.g., 100ms) between them.
- Configure the tRPC client to use `httpBatchStreamLink`.
- Create a Next.js client component at the root page (`app/page.tsx` or `src/app/page.tsx`) that calls `streamWords` and displays the words as they stream in, joined by a space.
- The final displayed text should be "Hello streaming world".

## Constraints
- Project path: `/home/user/project`
- Start command: `npm run dev`
- Port: 3000