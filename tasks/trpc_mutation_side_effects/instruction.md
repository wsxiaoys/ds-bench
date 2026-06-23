# tRPC v11 Mutation Side Effects

## Background
You have a Next.js project with tRPC v11 and React Query v5 set up in `/home/user/project`. It has a simple router with a `getTodos` query and an `addTodo` mutation. In `src/app/page.tsx`, the `addTodo` mutation is called when a form is submitted. However, the `getTodos` query is not invalidated after the mutation, so the UI doesn't update automatically to show the newly added todo.

## Requirements
- Implement the mutation side effect to invalidate the `getTodos` query upon a successful `addTodo` mutation.
- Ensure the UI updates automatically after adding a new todo.

## Implementation Guide
1. Open `/home/user/project/src/app/page.tsx`.
2. Access the tRPC utility context using `trpc.useUtils()`.
3. In the `onSuccess` callback of the `addTodo` mutation (or via the `useMutation` options), call `utils.getTodos.invalidate()`.

## Constraints
- Project path: /home/user/project
- Start command: npm run build && npm start
- Port: 3000
