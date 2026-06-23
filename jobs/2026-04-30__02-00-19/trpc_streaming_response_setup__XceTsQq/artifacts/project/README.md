# tRPC v11 Streaming Response Demo

This is a Next.js App Router project that demonstrates tRPC v11's native streaming support using `AsyncGenerator` and `httpBatchStreamLink`.

## Project Structure

### Server Files

- **src/server/trpc.ts**: tRPC initialization and context creation
- **src/server/router.ts**: Contains the `streamWords` procedure that yields words using `async function*`
- **src/app/api/trpc/[...trpc]/route.ts**: Next.js App Router API route handler for tRPC

### Client Files

- **src/utils/trpc.ts**: tRPC client configuration with `httpBatchStreamLink`
- **src/app/layout.tsx**: Root layout with TRPCProvider wrapper
- **src/app/page.tsx**: Client component that calls the streaming endpoint

## Features

- Streaming endpoint that yields words "Hello", "streaming", "world" with 100ms delays
- Real-time display of streaming words as they arrive
- Final displayed text: "Hello streaming world"

## How to Run

```bash
npm run dev
```

The application will be available at http://localhost:3000

## Dependencies

- next
- react
- react-dom
- @trpc/server@next
- @trpc/client@next
- @trpc/react-query@next
- @tanstack/react-query@latest
- zod

## Key Implementation Details

### Server-side Streaming

The `streamWords` procedure uses an `async function*` to yield words:

```typescript
export const appRouter = router({
  streamWords: publicProcedure
    .input(z.object({}).optional())
    .mutation(async function* () {
      const words = ['Hello', 'streaming', 'world'];
      
      for (const word of words) {
        await new Promise((resolve) => setTimeout(resolve, 100));
        yield word;
      }
    }),
});
```

### Client-side Streaming

The client consumes the stream using `for await...of`:

```typescript
const streamWordsMutation = trpc.streamWords.useMutation({
  onSuccess: async (stream) => {
    for await (const word of stream) {
      setStreamedText((prev) => {
        if (prev === '') return word;
        return `${prev} ${word}`;
      });
    }
  },
});
```

### tRPC Client Configuration

The client is configured with `httpBatchStreamLink` for streaming support:

```typescript
const trpcClient = trpc.createClient({
  links: [
    httpBatchStreamLink({
      url: 'http://localhost:3000/api/trpc',
    }),
  ],
});
```