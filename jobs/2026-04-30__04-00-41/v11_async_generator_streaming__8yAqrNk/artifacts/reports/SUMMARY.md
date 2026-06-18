# tRPC v11 Async Generator Streaming — Summary

## Project
- Path: `/home/user/myproject`
- Framework: Next.js 14 (App Router)
- Streaming: tRPC v11 `httpBatchStreamLink` + `AsyncGenerator`

## Versions installed
- next: 14.2.35
- @trpc/server: 11.17.0
- @trpc/client: 11.17.0
- @trpc/react-query: 11.17.0
- @tanstack/react-query: 5.59.x
- superjson: 2.2.x
- zod: 3.23.x

## Key files
- `server/trpc.ts` — tRPC init with superjson transformer.
- `server/routers/_app.ts` — defines the `chatStream` procedure as an
  `async function*` query that yields one word at a time.
- `app/api/trpc/[trpc]/route.ts` — Next.js App Router fetch handler.
- `app/_trpc/Provider.tsx` — wraps the app with `httpBatchStreamLink`
  so async generators stream end-to-end.
- `utils/trpc.ts` — shared `createTRPCReact` instance.
- `app/page.tsx` — client component that consumes the stream with
  `for await` and renders chunks in real time.

## Verified streaming over the wire
A direct curl with `trpc-accept: application/jsonl` produced one JSON
line per yielded token (chunks delivered progressively, not buffered).

```
{"json":[3,1,[["You "]]]}
{"json":[3,1,[["said: "]]]}
{"json":[3,1,[["\"hi\". "]]]}
... (one line per yield)
```

## Run
```
cd /home/user/myproject
npm run dev   # serves on port 3000
```
