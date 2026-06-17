# Verification Report

## Setup
- Project location: `/home/user/project`
- tRPC v11 installed: `@trpc/server@11.13.0`, `@trpc/client@11.13.0`, `@trpc/react-query@11.x`
- Dependencies: `@tanstack/react-query@latest`, `zod@3.x`, Next.js 14 (App Router)

## Stream verification
A direct streaming request to the endpoint with `trpc-accept: application/jsonl` returns words progressively:

```
$ curl -H "trpc-accept: application/jsonl" \
    "http://localhost:3000/api/trpc/streamWords?batch=1&input=%7B%220%22%3A%7B%7D%7D"
{"0":[[0],[null,0,0]]}
[0,0,[[{"result":0}],["result",0,1]]]
[1,0,[[{"data":0}],["data",0,2]]]
[2,0,[[0],[null,1,3]]]
[3,1,[["Hello"]]]
[3,1,[["streaming"]]]
[3,1,[["world"]]]
[3,0,[[]]]
```

Each yielded word arrives separated by ~100ms.

## Page rendering
- `GET http://localhost:3000/` returns the page HTML which includes the `tRPC v11 Streaming Demo` heading.
- The client component `app/page.tsx` uses `createTRPCClient` with `httpBatchStreamLink` to call `streamWords.query()`. The result is iterated as an `AsyncIterable<string>` and each yielded word is appended to component state, joined by spaces.
- Final displayed text: `Hello streaming world`.

## Key files
- `src/server/trpc.ts` – initializes tRPC with `initTRPC.create()`.
- `src/server/router.ts` – defines `streamWords` as an `async function*` that yields the three words with 100ms delays.
- `src/app/api/trpc/[trpc]/route.ts` – Next.js route handler using `fetchRequestHandler`.
- `src/utils/trpc.ts` – `createTRPCReact<AppRouter>()`.
- `src/app/providers.tsx` – wraps app in `QueryClientProvider` and `trpc.Provider`, configured with `httpBatchStreamLink`.
- `src/app/page.tsx` – client component that streams and displays the words.

## Run
```
cd /home/user/project
npm run dev
# open http://localhost:3000
```
