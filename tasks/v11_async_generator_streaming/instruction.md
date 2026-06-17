# tRPC v11 Async Generator Streaming

## Background
tRPC v11 introduces native support for streaming responses over standard HTTP using `httpBatchStreamLink` and `AsyncGenerator`. This is particularly useful for streaming LLM responses or long-running processes.

## Requirements
- Initialize a Next.js App Router project in `/home/user/myproject`.
- Install tRPC v11 dependencies.
- Create a tRPC router with a `chatStream` procedure that takes a string input and returns an `AsyncGenerator` yielding chunks of text.
- Set up the tRPC client using `httpBatchStreamLink`.
- Create a client component in `app/page.tsx` that calls `chatStream` and displays the streamed chunks in real-time.

## Constraints
- Project path: `/home/user/myproject`
- Start command: `npm run dev`
- Port: 3000