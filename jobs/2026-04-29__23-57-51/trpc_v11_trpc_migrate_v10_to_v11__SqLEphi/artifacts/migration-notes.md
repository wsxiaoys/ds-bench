# tRPC v10 → v11 Migration Notes

## Packages Upgraded
- `@trpc/server`: `^10.45.0` → `11.13.0` (installed via `npm install @trpc/server@next`)
- `@trpc/client`: `^10.45.0` → `11.13.0` (installed via `npm install @trpc/client@next`)

## Breaking Change: `transformer` on the client

### v10 (old)
```ts
const client = createTRPCProxyClient<AppRouter>({
  transformer: superjson,        // ← top-level, DEPRECATED in v11
  links: [
    httpBatchLink({ url: '...' }),
  ],
});
```

### v11 (new)
```ts
const client = createTRPCProxyClient<AppRouter>({
  links: [
    httpBatchLink({
      url: '...',
      transformer: superjson,    // ← moved inside the link
    }),
  ],
});
```

## Server-side: No Change Required
The server-side `transformer` option on `initTRPC.create()` remains the same in v11:
```ts
const t = initTRPC.create({
  transformer: superjson,  // still valid in v11
});
```

## Verification
Client output after migration:
```
Response: { status: 'success', time: 2026-04-29T16:54:31.199Z }
```
The `time` field is a proper `Date` object, confirming superjson deserialization works correctly.
