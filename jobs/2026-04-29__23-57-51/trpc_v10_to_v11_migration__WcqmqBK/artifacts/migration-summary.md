# tRPC v10 → v11 Migration Summary

## Dependencies Updated

| Package | Before | After |
|---|---|---|
| `@trpc/server` | `^10.45.0` | `11.13.0` (`@next`) |
| `@trpc/client` | `^10.45.0` | `11.13.0` (`@next`) |
| `@trpc/react-query` | `^10.45.0` | `11.13.0` (`@next`) |
| `@trpc/next` | `^10.45.0` | `11.13.0` (`@next`) |
| `@tanstack/react-query` | `^4.36.1` | `5.100.6` (`@latest`) |

## Code Change: `src/utils/trpc.ts`

### Before (v10)
```ts
export const trpc = createTRPCNext<AppRouter>({
  config() {
    return {
      transformer: superjson,          // ← at config root
      links: [
        httpBatchLink({
          url: `${getBaseUrl()}/api/trpc`,
        }),
      ],
    };
  },
  ssr: false,
});
```

### After (v11)
```ts
export const trpc = createTRPCNext<AppRouter>({
  config() {
    return {
      links: [
        httpBatchLink({
          url: `${getBaseUrl()}/api/trpc`,
          transformer: superjson,      // ← moved inside httpBatchLink
        }),
      ],
    };
  },
  ssr: false,
});
```

## Verification

Dev server started on port 3000. API endpoint confirmed working:

```
GET /api/trpc/hello?batch=1&input={"0":{"json":{"text":"world"}}}

Response: [{"result":{"data":{"json":{"greeting":"Hello from tRPC v11 world"}}}}]
```
