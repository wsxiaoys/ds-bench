# tRPC v11 Async Generator Streaming Demo

This Next.js App Router project demonstrates tRPC v11 streaming over standard HTTP.

## Features

- tRPC v11 server route in the App Router
- `chatStream` procedure returning an `AsyncGenerator<string>`
- Client configured with `httpBatchStreamLink`
- Real-time streamed chunk rendering in `app/page.tsx`

## Run locally

```bash
npm run dev
```

Open `http://localhost:3000` to test the stream.
