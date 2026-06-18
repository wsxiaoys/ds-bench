# tRPC v11 AI Streaming Chat

## Background
Implement a streaming AI chat interface using tRPC v11's new `httpBatchStreamLink` and `AsyncGenerator` support. This allows streaming responses directly from the server to the client over standard HTTP, which is useful for AI chat applications where responses are generated token by token.

## Requirements
- You are provided with a basic Next.js App Router project in `/home/user/project` with tRPC v11 already installed and a basic server/client setup.
- Modify the tRPC client configuration to use `httpBatchStreamLink` instead of `httpBatchLink`.
- Implement a public procedure named `chatStream` in the tRPC router (`src/server/trpc/router.ts`) that takes a string input (the prompt) and uses an `async function*` to yield chunks of a simulated AI response. For testing purposes, the generator should yield the following chunks sequentially: `"Hello"`, `", "`, `"World"`, `"!"`.
- Update the main page (`src/app/page.tsx`) to include a client component that calls this `chatStream` query and displays the chunks as they arrive. The final displayed text must be `Hello, World!`.

## Constraints
- Project path: `/home/user/project`
- Start command: `npm run dev`
- Port: `3000`
- The tRPC client MUST use `httpBatchStreamLink`.
- The server procedure MUST use `publicProcedure.query(async function* () { ... })` and yield the exact chunks specified.