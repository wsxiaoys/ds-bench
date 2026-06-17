# tRPC v11 Async Generator Streaming Implementation

## Overview
This project demonstrates tRPC v11's native support for streaming responses over standard HTTP using `httpBatchStreamLink` and `AsyncGenerator`. This is particularly useful for streaming LLM responses or long-running processes.

## Project Structure

```
/home/user/myproject/
├── app/
│   ├── api/
│   │   └── trpc/
│   │       └── [trpc]/
│   │           └── route.ts          # tRPC API route handler
│   ├── layout.tsx                    # Root layout with TRPCProvider
│   ├── page.tsx                      # Client component with streaming UI
│   └── providers.tsx                 # tRPC and React Query providers
├── lib/
│   └── trpc/
│       └── client.ts                 # tRPC client configuration
└── server/
    └── api/
        └── trpc/
            ├── context.ts            # tRPC context creation
            ├── router.ts             # tRPC router with chatStream procedure
            └── server.ts             # Server exports
```

## Key Components

### 1. tRPC Server Setup (`server/api/trpc/router.ts`)

The core streaming procedure:

```typescript
chatStream: t.procedure
  .input((val: unknown) => {
    if (typeof val === 'string') return val;
    throw new Error('Input must be a string');
  })
  .output(asyncIterable(z => z.string()))
  .query(async function* ({ input }) {
    // Simulate streaming response
    const words = input.split(' ');
    
    for (const word of words) {
      // Simulate processing delay
      await new Promise(resolve => setTimeout(resolve, 100));
      yield word + ' ';
    }
    
    // Add a completion message
    await new Promise(resolve => setTimeout(resolve, 200));
    yield '\n\nStream complete!';
  }),
```

**Key Features:**
- Uses `async function*` to create an AsyncGenerator
- Uses `output(asyncIterable(z => z.string()))` to define streaming output
- Yields chunks of text with simulated delays
- Returns an iterable that can be consumed on the client

### 2. tRPC Client Setup (`lib/trpc/client.ts`)

Client configuration with streaming support:

```typescript
export function getTRPCClient() {
  return trpc.createClient({
    links: [
      httpBatchStreamLink({
        url: '/api/trpc',
        transformer: superjson,
      }),
    ],
  });
}
```

**Key Features:**
- Uses `httpBatchStreamLink` for streaming support
- Configured with superjson for data transformation
- Connects to the `/api/trpc` endpoint

### 3. Client Component (`app/page.tsx`)

Streaming consumption on the client:

```typescript
const handleStream = async () => {
  if (!input.trim()) return;

  setIsStreaming(true);
  setOutput('');

  try {
    const inputStream = chatStream.mutateAsync(input);
    
    for await (const chunk of inputStream) {
      setOutput((prev) => prev + chunk);
    }
  } catch (error) {
    console.error('Stream error:', error);
    setOutput('Error occurred during streaming');
  } finally {
    setIsStreaming(false);
  }
};
```

**Key Features:**
- Uses `chatStream.mutateAsync()` to initiate streaming
- Consumes the stream with `for await (const chunk of inputStream)`
- Updates UI in real-time as chunks arrive
- Handles errors and loading states

### 4. API Route Handler (`app/api/trpc/[trpc]/route.ts`)

Next.js App Router API route:

```typescript
import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { appRouter } from '@/server/api/trpc/router';
import { createContext } from '@/server/api/trpc/context';

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: '/api/trpc',
    req,
    router: appRouter,
    createContext,
  });

export { handler as GET, handler as POST };
```

**Key Features:**
- Uses `fetchRequestHandler` from tRPC
- Supports both GET and POST methods
- Integrates with Next.js App Router

## How It Works

1. **Client Request**: User enters text and clicks "Start Streaming"
2. **tRPC Call**: Client calls `chatStream.mutateAsync(input)`
3. **Server Processing**: Server receives request and starts AsyncGenerator
4. **Streaming Response**: Server yields chunks of data one at a time
5. **Client Consumption**: Client receives chunks and updates UI in real-time
6. **Completion**: Stream completes when generator finishes

## Dependencies

```json
{
  "@trpc/server": "^11.0.0",
  "@trpc/client": "^11.0.0",
  "@trpc/react-query": "^11.0.0",
  "@trpc/next": "^11.0.0",
  "superjson": "^2.2.1",
  "@tanstack/react-query": "^5.0.0",
  "@tanstack/react-query-devtools": "^5.0.0"
}
```

## Running the Project

```bash
cd /home/user/myproject
npm run dev
```

The application will be available at `http://localhost:3000`

## Testing the Streaming

1. Open the application in your browser
2. Enter text in the textarea (e.g., "Hello world this is a test")
3. Click "Start Streaming"
4. Watch the text stream back word by word with visual feedback
5. The output will show each word appearing with a 100ms delay

## Use Cases

This streaming pattern is ideal for:

- **LLM Chat Interfaces**: Stream AI responses token by token
- **Long-running Operations**: Show progress updates in real-time
- **Data Processing**: Stream large datasets as they're processed
- **Real-time Analytics**: Display metrics as they're computed
- **File Uploads**: Show upload progress

## Benefits of tRPC v11 Streaming

1. **Type Safety**: Full end-to-end type safety for streaming operations
2. **Simple API**: Native AsyncGenerator support without complex setup
3. **Standard HTTP**: Works over standard HTTP without WebSockets
4. **Batch Support**: Can batch multiple streaming requests
5. **Automatic Serialization**: Built-in data transformation with superjson

## Customization

You can customize the streaming behavior by:

1. **Adjusting Delays**: Modify the `setTimeout` values in the router
2. **Changing Chunk Size**: Yield larger or smaller chunks
3. **Adding Error Handling**: Implement custom error recovery
4. **Transforming Data**: Process data before yielding
5. **Adding Metadata**: Include additional information in the stream

## Key Takeaways

- tRPC v11 provides native streaming support with AsyncGenerator
- `httpBatchStreamLink` enables streaming over standard HTTP
- The pattern is type-safe and easy to implement
- Perfect for real-time applications and LLM interfaces
- No need for WebSockets or complex infrastructure