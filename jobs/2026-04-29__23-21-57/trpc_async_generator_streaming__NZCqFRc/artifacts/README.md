# tRPC v11 Streaming Chat Interface

## Overview
This project demonstrates tRPC v11's native support for `AsyncGenerator` and streaming responses over HTTP using `httpBatchStreamLink`.

## Project Structure
```
/home/user/app/
├── server/
│   ├── trpc.ts              # tRPC server configuration
│   └── routers/
│       └── app.ts           # App router with chat procedure
├── app/
│   ├── api/trpc/[trpc]/
│   │   └── route.ts         # tRPC Next.js API route handler
│   └── page.tsx             # Chat UI with streaming display
└── package.json             # Dependencies
```

## Key Features

### 1. tRPC Server Setup (`server/trpc.ts`)
- Configures tRPC with context creation
- Exports `router` and `publicProcedure` for use in routers

### 2. Chat Procedure with AsyncGenerator (`server/routers/app.ts`)
- Implements a `chat` query procedure that accepts a string input
- Returns an `AsyncGenerator` that yields characters one by one
- Simulates streaming AI response with 50ms delay between characters
- Uses `async function*` syntax for native generator support

### 3. API Route Handler (`app/api/trpc/[trpc]/route.ts`)
- Creates Next.js API route for tRPC
- Uses `fetchRequestHandler` from tRPC
- Handles both GET and POST requests

### 4. Client with Streaming Support (`app/page.tsx`)
- Creates tRPC client using `createTRPCClient`
- Configures `httpBatchStreamLink` for streaming over HTTP
- Implements chat UI with:
  - Input field (id: `chat-input`)
  - Submit button (id: `chat-submit`)
  - Response display area (id: `chat-response`)
- Uses `for await...of` loop to consume the streamed response
- Updates the UI in real-time as characters arrive

## Technologies Used
- **Next.js 16.2.4** - React framework with App Router
- **React 19.2.4** - UI library
- **tRPC v11** - TypeScript-first RPC framework
  - `@trpc/server@next`
  - `@trpc/client@next`
  - `@trpc/react-query@next`
- **TypeScript 5** - Type-safe development
- **Tailwind CSS 4** - Styling

## How It Works

1. User types a message in the input field and clicks "Send"
2. Client calls `client.chat.query(input)` which returns a Promise
3. The Promise resolves to an AsyncIterable (the stream)
4. The `for await...of` loop iterates over the stream
5. Each character is yielded from the server with a 50ms delay
6. The UI updates in real-time as characters arrive
7. All streaming happens over standard HTTP without WebSockets or SSE

## Running the Application

```bash
# Build the application
npm run build

# Start the production server
npm start
```

The application will be available at `http://localhost:3000`

## Testing

1. Navigate to `http://localhost:3000`
2. Type a message in the input field
3. Click "Send" to see the streaming response
4. Watch as characters appear one by one with a 50ms delay

## Key Benefits of tRPC v11 Streaming

- **Native AsyncGenerator Support**: No need for external streaming libraries
- **HTTP-based Streaming**: Uses standard HTTP with `httpBatchStreamLink`
- **Type Safety**: Full TypeScript support throughout the stack
- **Simple API**: Clean, intuitive syntax with `async function*`
- **Real-time Updates**: UI updates as data streams in