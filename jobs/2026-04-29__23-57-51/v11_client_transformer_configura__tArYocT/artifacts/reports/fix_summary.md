# tRPC v11 Transformer Fix Summary

## Problem

In `client/trpc.ts`, the `superjson` transformer was placed at the root of `createTRPCClient()` — the v10 API:

```ts
// ❌ v10 style — broken in v11
export const trpc = createTRPCClient<AppRouter>({
  transformer: superjson,   // <-- root-level, no longer supported
  links: [
    httpBatchLink({ url: 'http://localhost:3000' }),
  ],
});
```

tRPC v11 removed the root-level `transformer` option from `createTRPCClient`. Passing it there throws a `TypeError` and causes all complex types (Date, Map, Set, BigInt, etc.) to be deserialized incorrectly.

## Fix

Move `transformer: superjson` inside the `httpBatchLink` configuration object:

```ts
// ✅ v11 style — correct
export const trpc = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url: 'http://localhost:3000',
      transformer: superjson,   // <-- per-link, v11 API
    }),
  ],
});
```

Every terminating link (`httpBatchLink`, `httpLink`, `wsLink`, `httpSubscriptionLink`) must carry its own `transformer` option. The server-side `initTRPC.create({ transformer: superjson })` was already correct and was left untouched.

## Verification

Running `npx tsx client/index.ts` against the live server produced:

```
Successfully fetched Date object: 2026-04-28T10:00:00.000Z
```

The returned value passes `instanceof Date`, confirming superjson is correctly deserializing the server response on the client.
