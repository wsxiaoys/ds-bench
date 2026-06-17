# tRPC v11 Basic Streaming Setup

This implementation demonstrates tRPC v11 streaming capabilities using `httpBatchStreamLink` with `AsyncGenerator` procedures.

## Project Structure

```
/home/user/app/
├── src/
│   ├── app/
│   │   ├── api/trpc/[trpc]/route.ts    # tRPC API route handler
│   │   ├── layout.tsx                   # Root layout with TRPCProvider
│   │   └── page.tsx                     # Client component consuming stream
│   ├── client/
│   │   ├── trpc.ts                      # tRPC client instance
│   │   └── trpc-provider.tsx            # React Query + tRPC provider
│   └── server/
│       └── trpc/
│           ├── init.ts                  # tRPC API route initialization
│           └── router.ts                # tRPC router with streaming procedure
```

## Key Features

### 1. Server-Side Streaming (`src/server/trpc/router.ts`)

The `streamNumbers` procedure uses an `AsyncGenerator` to yield numbers with delays:

```typescript
streamNumbers: t.procedure
  .input(z.void())
  .query(async function* () {
    for (const num of [1, 2, 3]) {
      yield num;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }),
```

### 2. Streaming Link Configuration (`src/client/trpc-provider.tsx`)

Uses `httpBatchStreamLink` instead of `httpBatchLink` for streaming support:

```typescript
httpBatchStreamLink({
  url: "/api/trpc",
}),
```

### 3. Client-Side Consumption (`src/app/page.tsx`)

Consumes the stream using `useEffect` to process the `AsyncIterable`:

```typescript
const { data } = trpc.streamNumbers.useQuery();

useEffect(() => {
  if (data) {
    const processStream = async () => {
      const numbers: number[] = [];
      for await (const num of data) {
        numbers.push(num);
      }
      setOutput(numbers.join(", "));
    };
    processStream();
  }
}, [data]);
```

## Usage

1. **Build the application:**
   ```bash
   npm run build
   ```

2. **Start the production server:**
   ```bash
   npm start
   ```

3. **Visit the application:**
   Navigate to `http://localhost:3000` to see the streaming numbers displayed as `1, 2, 3`.

## Technical Details

- **tRPC Version**: 11.13.0
- **Next.js Version**: 16.2.4
- **Streaming Protocol**: HTTP with `httpBatchStreamLink`
- **Client Integration**: React Query v5 for state management
- **Stream Type**: `AsyncGenerator<number>` yielding integers with 50ms delays

## Output

The page displays:
- Title: "tRPC v11 Streaming"
- Stream output: `1, 2, 3` (displayed in a div with id `stream-output`)

## Notes

- The streaming happens over standard HTTP, no WebSockets required
- Each number is yielded with a 50ms delay, demonstrating progressive loading
- The client processes the stream asynchronously and displays the final result
- Error handling is built-in through tRPC's type-safe error system