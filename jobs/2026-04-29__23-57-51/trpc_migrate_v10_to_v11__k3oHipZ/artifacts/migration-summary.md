# tRPC v10 → v11 Migration Summary

## Packages Updated

| Package | From | To |
|---------|------|----|
| `@trpc/server` | `^10.45.2` | `^11.13.0` |
| `@trpc/client` | `^10.45.2` | `^11.13.0` |
| `@trpc/next` | `^10.45.2` | `^11.13.0` |
| `@trpc/react-query` | `^10.45.2` | `^11.13.0` |
| `@tanstack/react-query` | `^4.36.1` | `^5.100.6` |

---

## File Changes

### `src/utils/trpc.ts`
**Breaking change:** In v11, `transformer` is no longer accepted inside the `config()` return object at the root level. Instead:
1. The `transformer` must be passed as a **top-level property** on the `createTRPCNext` options object (for SSR hydration deserialization).
2. The `transformer` must **also** be passed inside `httpBatchLink` (for wire-level serialization).

```diff
- export const trpc = createTRPCNext<AppRouter>({
-   config(opts) {
-     return {
-       transformer: superjson,          // ← removed from here
-       links: [
-         httpBatchLink({
-           url: `${getBaseUrl()}/api/trpc`,
-         }),
-       ],
-     };
-   },
-   ssr: false,
- });
+ export const trpc = createTRPCNext<AppRouter>({
+   transformer: superjson,              // ← moved to top level
+   config(opts) {
+     return {
+       links: [
+         httpBatchLink({
+           url: `${getBaseUrl()}/api/trpc`,
+           transformer: superjson,      // ← also added inside link
+         }),
+       ],
+     };
+   },
+   ssr: false,
+ });
```

---

### `src/server/context.ts`
**Breaking change:** In v11, `CreateNextContextOptions` exposes an `info` field of type `TRPCRequestInfo`. Procedure input is no longer directly available on the context at creation time. Use `info.calls[0].getRawInput()` (an async function) to access raw input before procedure execution.

```diff
  export async function createContext(opts: trpcNext.CreateNextContextOptions) {
+   const rawInput = opts.info.calls.length > 0
+     ? await opts.info.calls[0].getRawInput()
+     : undefined;
+
    return {
      req: opts.req,
      res: opts.res,
+     rawInput,
    };
  }
```

---

### `src/pages/_app.tsx` (bonus fix)
Pre-existing type error: `AppProps` must be imported from `next/app`, not `next`.

```diff
- import type { AppProps } from 'next';
+ import type { AppProps } from 'next/app';
```

---

## Build Result
✓ Compiled successfully — all pages and API routes generated without errors.
