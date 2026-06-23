# tRPC v11 Custom Error Formatter

## Background
You have an Express.js server in `/home/user/app` that exposes a tRPC v11 API. It has a mutation `addPost` that takes a `title` (string, min length 5) using Zod. Currently, when validation fails, the default error shape is returned, which is not very friendly for the client to parse Zod errors.

## Requirements
Modify the tRPC initialization to include a custom `errorFormatter`.
- When a `BAD_REQUEST` error is thrown and the cause is a `ZodError`, you must add a `zodError` property to the `data` object of the error shape.
- The `zodError` property should contain the flattened Zod error (using `error.cause.flatten()`).
- For other errors, `zodError` should be `null`.

## Implementation Guide
1. Open `/home/user/app/server.ts`.
2. Find the `initTRPC.create()` call.
3. Add the `errorFormatter` option.
4. Check if `error.code === 'BAD_REQUEST'` and `error.cause instanceof ZodError`.
5. If so, append `zodError: error.cause.flatten()` to the `data` object of the returned shape. Otherwise, `zodError: null`.

## Constraints
- Project path: /home/user/app
- Start command: npm start
- Port: 3000