# tRPC Client Usage Example

## Server-Side Router Structure
```typescript
// src/server/routers/_app.ts
export const appRouter = router({
  user: userRouter,  // Contains user.getUser
  post: postRouter,  // Contains post.getPost
});
export type AppRouter = typeof appRouter;
```

## Client-Side Usage

### 1. Create tRPC Client
```typescript
// src/utils/trpc.ts
import { createTRPCReact } from '@trpc/react-query';
import type { AppRouter } from '~/server/routers/_app';

export const trpc = createTRPCReact<AppRouter>();
```

### 2. Wrap Your App with Providers
```typescript
// src/app/layout.tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { httpBatchLink } from '@trpc/client';
import { trpc } from '~/utils/trpc';

const queryClient = new QueryClient();
const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: 'http://localhost:3000/api/trpc',
    }),
  ],
});

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </trpc.Provider>
  );
}
```

### 3. Use the Namespaced Procedures in Components
```typescript
// src/app/page.tsx
import { trpc } from '~/utils/trpc';

export default function HomePage() {
  // Using the user namespace
  const { data: user, isLoading: userLoading } = trpc.user.getUser.useQuery();
  
  // Using the post namespace
  const { data: post, isLoading: postLoading } = trpc.post.getPost.useQuery();

  if (userLoading || postLoading) return <div>Loading...</div>;

  return (
    <div>
      <h1>User: {user?.name}</h1>
      <p>Post: {post?.title}</p>
    </div>
  );
}
```

## Benefits of Namespacing

1. **Type Safety**: Full autocomplete for all procedures
2. **Organization**: Logical grouping of related procedures
3. **Scalability**: Easy to add new routers and namespaces
4. **Clarity**: Clear separation of concerns (user vs post operations)

## Available Procedures

### User Namespace
- `trpc.user.getUser` - Get user information

### Post Namespace
- `trpc.post.getPost` - Get post information

## Adding New Routers

To add a new router (e.g., `commentRouter`):

1. Create the router file:
```typescript
// src/server/routers/comment.ts
import { publicProcedure, router } from '../trpc';

export const commentRouter = router({
  getComment: publicProcedure.query(() => {
    return { id: "1", text: "Great post!" };
  }),
});
```

2. Add it to the appRouter:
```typescript
// src/server/routers/_app.ts
import { commentRouter } from './comment';

export const appRouter = router({
  user: userRouter,
  post: postRouter,
  comment: commentRouter,  // Add new router
});
```

3. Use it on the client:
```typescript
const { data: comment } = trpc.comment.getComment.useQuery();
```