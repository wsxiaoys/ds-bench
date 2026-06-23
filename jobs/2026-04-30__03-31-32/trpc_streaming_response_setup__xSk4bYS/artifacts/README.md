# tRPC v11 Streaming Response Setup

## Project location
`/home/user/project`

## Start command
```bash
cd /home/user/project && npm run dev
```
Runs on port 3000.

## Architecture

```
/home/user/project/
├── server/
│   ├── trpc.ts                          # tRPC init (router + publicProcedure)
│   └── routers/
│       └── _app.ts                      # AppRouter with streamWords procedure
├── lib/
│   └── trpc/
│       └── client.ts                    # tRPC React client + vanilla client (httpBatchStreamLink)
├── app/
│   ├── api/trpc/[trpc]/route.ts         # Next.js API route (fetchRequestHandler)
│   ├── providers.tsx                    # QueryClientProvider + trpc.Provider
│   ├── layout.tsx                       # Root layout wrapping with <Providers>
│   └── page.tsx                         # Client component: streams words via useEffect
└── package.json
```

## Key tRPC v11 streaming details

1. **Server procedure** (`server/routers/_app.ts`):
   - Uses `publicProcedure.query(async function* () { ... })` 
   - Yields "Hello", "streaming", "world" with 100ms delay between each

2. **Transport** (`lib/trpc/client.ts`):
   - Uses `httpBatchStreamLink` which sends `trpc-accept: application/jsonl` header
   - Responses are streamed as JSONL (newline-delimited JSON)

3. **Client consumption** (`app/page.tsx`):
   - The vanilla tRPC client's `query()` returns `Promise<AsyncIterable<string>>` when the server uses an async generator
   - A `useEffect` consumes the iterable with `for await...of` and appends words to state

4. **Wire format** (verified via curl):
   ```
   {\"0\":[[0],[null,0,0]]}
   [0,0,[[{\"result\":0}],[\"result\",0,1]]]
   [1,0,[[{\"data\":0}],[\"data\",0,2]]]
   [2,0,[[0],[null,1,3]]]
   [3,1,[[\"Hello\"]]]
   [3,1,[[\"streaming\"]]]
   [3,1,[[\"world\"]]]
   [3,0,[[]]]
   ```

## Final displayed text
**"Hello streaming world"**
