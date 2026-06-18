# tRPC v10 → v11 Migration Summary

## Changes Made

### 1. `package.json`
Upgraded both tRPC packages to v11 (`next` tag, resolved to `11.13.0`):
- `@trpc/server`: `^10.45.0` → `next`
- `@trpc/client`: `^10.45.0` → `next`

### 2. `client.ts`
Per the v11 requirements, the `superjson` transformer must be configured per-link
(inside `httpBatchLink`) instead of being a top-level option on the proxy client.

**Before (v10):**
```ts
const client = createTRPCProxyClient<AppRouter>({
  transformer: superjson,
  links: [
    httpBatchLink({
      url: 'http://localhost:3000',
    }),
  ],
});
```

**After (v11):**
```ts
const client = createTRPCProxyClient<AppRouter>({
  links: [
    httpBatchLink({
      url: 'http://localhost:3000',
      transformer: superjson,
    }),
  ],
});
```

### 3. `server.ts`
No changes required — the server-side `initTRPC.create({ transformer: superjson })`
configuration is identical between v10 and v11.

## Verification

Server output:
```
Server running on port 3000
```

Client output:
```
Response: { status: 'success', time: 2026-04-29T20:38:30.459Z }
time is Date instance: true
```

The `time` field is correctly deserialized as a real `Date` instance via superjson,
confirming the transformer is properly wired through the v11 link.
