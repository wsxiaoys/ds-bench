# tRPC v11 Streaming Chat Interface

## Overview
A Next.js 16 App Router application implementing a streaming chat interface using tRPC v11's native `AsyncGenerator` support over HTTP with `httpBatchStreamLink`.

## File Structure

```
/home/user/app/
├── server/
│   ├── trpc.ts                        # tRPC init: router + publicProcedure exports
│   └── routers/
│       └── app.ts                     # AppRouter with `chat` streaming procedure
├── app/
│   ├── api/trpc/[trpc]/
│   │   └── route.ts                   # Next.js fetch handler for tRPC
│   ├── providers.tsx                  # QueryClient + tRPC React provider (client component)
│   ├── layout.tsx                     # Root layout wrapping children in <Providers>
│   └── page.tsx                       # Chat UI (chat-input, chat-submit, chat-response)
└── lib/
    └── trpc.ts                        # createTRPCReact + createTRPCClient with httpBatchStreamLink
```

## Key Implementation Details

### Streaming Procedure (`server/routers/app.ts`)
- `chat` is a `query` procedure that accepts a `z.string()` input
- Returns `async function*` yielding each character of the input with a 50ms delay
- tRPC v11 natively handles `AsyncGenerator` return types

### HTTP Streaming Transport
- Client uses `httpBatchStreamLink` from `@trpc/client`
- Server uses `fetchRequestHandler` from `@trpc/server/adapters/fetch`
- The link sends `trpc-accept: application/jsonl` header to enable streaming
- Response is streamed as JSONL (newline-delimited JSON)

### UI Behaviour
- `#chat-input`: controlled text input for the message
- `#chat-submit`: submit button, disabled while streaming
- `#chat-response`: pre-formatted area accumulating streamed characters in real-time
- Uses the vanilla `trpcClient` (not React Query hooks) to `for await` over the generator

## Build & Run
```bash
cd /home/user/app
npm run build && npm start
# App available at http://localhost:3000
```
