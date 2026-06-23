# tRPC v11 with Next.js Server Actions

This project demonstrates the integration of tRPC v11 with Next.js Server Actions to securely call backend procedures from the server.

## Project Structure

```
src/
├── app/
│   ├── actions.ts       # Server Actions that call tRPC procedures
│   ├── globals.css      # Global styles
│   ├── layout.tsx       # Root layout
│   └── page.tsx         # Main page with form
└── server/
    └── trpc.ts          # tRPC router and server-side caller
```

## Key Components

### 1. tRPC Router (`src/server/trpc.ts`)

The tRPC router is defined with:
- **Context**: Empty context for this example
- **Router**: Contains the `addMessage` mutation
- **Server Caller**: Created using `createCallerFactory` for server-side calls

```typescript
export const appRouter = t.router({
  addMessage: t.procedure
    .input(z.object({ text: z.string() }))
    .mutation(({ input }) => {
      return {
        success: true,
        message: input.text,
      };
    }),
});
```

### 2. Server Action (`src/app/actions.ts`)

Server Actions use the server-side caller to execute tRPC procedures:

```typescript
'use server';

import { serverCaller } from '@/server/trpc';

export async function addMessageAction(text: string) {
  try {
    const result = await serverCaller.addMessage({ text });
    return result;
  } catch (error) {
    console.error('Error in addMessageAction:', error);
    return {
      success: false,
      message: 'Failed to add message',
    };
  }
}
```

### 3. Client Component (`src/app/page.tsx`)

A client component with a form that triggers the Server Action:

```typescript
'use client';

import { useState } from 'react';
import { addMessageAction } from './actions';

export default function Home() {
  const [message, setMessage] = useState('');
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const response = await addMessageAction(message);
    setResult(response);
  }

  // Form JSX...
}
```

## Dependencies

- `@trpc/server@next`: tRPC server-side library
- `@trpc/client@next`: tRPC client-side library
- `@trpc/react-query@next`: tRPC React Query integration
- `@tanstack/react-query@latest`: React Query for data fetching
- `zod`: Schema validation
- `superjson`: JSON serialization

## How It Works

1. **Client submits form**: User enters a message in the form
2. **Server Action is triggered**: The form submission calls `addMessageAction`
3. **Server Action calls tRPC**: The action uses `serverCaller.addMessage()` to execute the mutation
4. **tRPC processes the mutation**: The mutation validates input with Zod and returns the result
5. **Result is displayed**: The client component updates the UI with the result

## Running the Project

```bash
cd /home/user/project
npm run dev
```

The application will be available at `http://localhost:3000`

## Key Features

- ✅ tRPC v11 integration
- ✅ Next.js App Router
- ✅ Server Actions for form handling
- ✅ Zod input validation
- ✅ Server-side caller using `createCallerFactory`
- ✅ TypeScript type safety
- ✅ Tailwind CSS styling
- ✅ Error handling

## Benefits

1. **Type Safety**: Full end-to-end type safety from client to server
2. **Server Actions**: Secure server-side execution without client-side API calls
3. **Validation**: Zod ensures data integrity at the API boundary
4. **Simplified Data Flow**: Direct server-to-server communication without HTTP overhead