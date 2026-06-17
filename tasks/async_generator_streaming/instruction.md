# tRPC v11 Streaming Chat Interface

## Background
tRPC v11 introduces native support for `AsyncGenerator` and streaming responses over HTTP using `httpBatchStreamLink`. This allows you to stream data (like AI chat responses) directly from a tRPC procedure without needing WebSockets or Server-Sent Events.

## Requirements
- You have a Next.js App Router project at `/home/user/app`.
- Set up tRPC v11 using `@trpc/server@next`, `@trpc/client@next`, and `@trpc/react-query@next`.
- Create a tRPC router with a `chat` query procedure that accepts a `string` input and returns an `AsyncGenerator`.
- The `chat` procedure should yield the input string character by character, with a 50ms delay between each character, to simulate a streaming AI response.
- Configure the tRPC client to use `httpBatchStreamLink` to enable streaming over standard HTTP.
- Build a chat UI on the homepage (`/`) with an input field (id: `chat-input`), a submit button (id: `chat-submit`), and a response display area (id: `chat-response`).
- When the user submits a message, the UI should call the `chat` procedure and display the streamed characters in the response area as they arrive.

## Implementation Guide
1. Install the necessary tRPC v11 packages in `/home/user/app`.
2. Define your tRPC router in `server/trpc.ts` and `server/routers/app.ts`.
3. Implement the `chat` procedure using an `async function*` that yields characters.
4. Create the tRPC Next.js API route handler in `app/api/trpc/[trpc]/route.ts`.
5. Set up the tRPC React Query client using `createTRPCClient` and `httpBatchStreamLink` in a client component.
6. Implement the UI in `app/page.tsx` to consume the streaming query.

## Constraints
- **Project path**: `/home/user/app`
- **Start command**: `npm run build && npm start`
- **Port**: 3000
- Must use tRPC v11 `httpBatchStreamLink` and native `AsyncGenerator` support.