# tRPC v11 Transformer Fix

## Problem
In `client/trpc.ts`, the `superjson` transformer was placed at the root of the `createTRPCClient` configuration. This is the v10 style and is invalid in tRPC v11 — it causes Date objects (and other complex types) to fail proper deserialization on the client.

## Fix
Moved the `transformer: superjson` option from the root of `createTRPCClient` into the `httpBatchLink` configuration object, per tRPC v11's API.

### Before
```ts
export const trpc = createTRPCClient<AppRouter>({
  transformer: superjson,
  links: [
    httpBatchLink({
      url: 'http://localhost:3000',
    }),
  ],
});
```

### After
```ts
export const trpc = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url: 'http://localhost:3000',
      transformer: superjson,
    }),
  ],
});
```

## Verification
- Started server: `npm run start:server`
- Ran client: `npm run test:client`
- Output: `Successfully fetched Date object: 2026-04-28T10:00:00.000Z`
- Client confirmed `time instanceof Date` is `true` (otherwise it would have exited with code 1).

## Constraints Respected
- `server/router.ts` was NOT modified.
- `httpBatchLink` remains the primary (and only) link.
- Server log written to `/home/user/project/output.log`.
