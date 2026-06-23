# tRPC v11 AsyncGenerator Streaming — Project Artifacts

## Project: `/home/user/myproject`
**Start**: `npm run dev` (port 3000)

---

## Architecture Overview

```
/home/user/myproject/
├── server/
│   ├── trpc.ts                         # tRPC init — exports router + publicProcedure
│   └── routers/
│       └── _app.ts                     # AppRouter with chatStream AsyncGenerator procedure
├── utils/
│   ├── trpc.ts                         # createTRPCReact<AppRouter> for react-query hooks
│   └── trpc-client.ts                  # Vanilla tRPC client with httpBatchStreamLink
├── app/
│   ├── layout.tsx                      # Root layout — wraps children in TRPCProvider
│   ├── providers.tsx                   # TRPCProvider (QueryClient + trpc.Provider)
│   ├── page.tsx                        # "use client" chat UI with streaming display
│   └── api/trpc/[trpc]/
│       └── route.ts                    # Next.js App Router tRPC fetch handler
└── package.json
```

---

## Key Design Decisions

### 1. `httpBatchStreamLink` (not `httpBatchLink`)
tRPC v11 introduces `httpBatchStreamLink` — the critical link type that reads
chunked HTTP responses incrementally. Without it, the client would wait for the
full response before resolving.

### 2. AsyncGenerator procedure
The `chatStream` procedure uses `async function*` syntax:
```ts
chatStream: publicProcedure
  .input(z.string())
  .query(async function* ({ input }): AsyncGenerator<string> {
    for (const word of words) {
      yield word + " ";
      await new Promise(r => setTimeout(r, 40 + Math.random() * 80));
    }
  })
```
tRPC v11 natively detects generator functions and streams their yielded values.

### 3. Client consumption (`for await...of`)
```ts
const stream = await trpcClient.chatStream.query(input);
for await (const chunk of stream) {
  // append chunk to UI in real time
}
```
The returned value is a standard `AsyncIterable<string>` — no special handling needed.

### 4. Fetch adapter for App Router
`fetchRequestHandler` from `@trpc/server/adapters/fetch` is compatible with
Next.js App Router's edge/node runtime and handles both GET and POST.

---

## Dependencies
- `@trpc/server@11.17.0`
- `@trpc/client@11.17.0`
- `@trpc/react-query@11.17.0`
- `@trpc/next@11.17.0`
- `@tanstack/react-query@5.x`
- `zod@4.x`
