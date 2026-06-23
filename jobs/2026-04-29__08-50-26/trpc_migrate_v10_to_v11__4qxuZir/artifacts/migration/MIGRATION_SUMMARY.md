# tRPC v10 to v11 Migration Summary

## Overview
Successfully migrated a Next.js application from tRPC v10 to v11.

## Changes Made

### 1. Package Dependencies (package.json)
- Upgraded `@trpc/client` from `^10.45.2` to `^11.0.0` (now at 11.17.0)
- Upgraded `@trpc/next` from `^10.45.2` to `^11.0.0` (now at 11.17.0)
- Upgraded `@trpc/react-query` from `^10.45.2` to `^11.0.0` (now at 11.17.0)
- Upgraded `@trpc/server` from `^10.45.2` to `^11.0.0` (now at 11.17.0)
- Upgraded `@tanstack/react-query` from `^4.36.1` to `^5.0.0` (now at 5.100.6)

### 2. Client Configuration (src/utils/trpc.ts)
**Key Change:** In tRPC v11, the transformer must be specified at BOTH the root level of `createTRPCNext` AND within the `httpBatchLink`.

**Before (v10):**
```typescript
export const trpc = createTRPCNext<AppRouter>({
  config(opts) {
    return {
      transformer: superjson,
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

**After (v11):**
```typescript
export const trpc = createTRPCNext<AppRouter>({
  transformer: superjson,
  config(opts) {
    return {
      links: [
        httpBatchLink({
          url: `${getBaseUrl()}/api/trpc`,
          transformer: superjson,
        }),
      ],
    };
  },
  ssr: false,
});
```

### 3. Server Context (src/server/context.ts)
**Key Change:** The `createContext` function now receives an `info` parameter that can be used to access raw request input before procedure execution.

**Before (v10):**
```typescript
export async function createContext(opts: trpcNext.CreateNextContextOptions) {
  return {
    req: opts.req,
    res: opts.res,
  };
}
```

**After (v11):**
```typescript
export async function createContext({
  req,
  res,
  info,
}: trpcNext.CreateNextContextOptions) {
  // Access raw input before procedure execution
  const rawInput = info.calls[0]?.getRawInput();

  return {
    req,
    res,
    rawInput,
  };
}
```

### 4. Server Router (src/server/routers.ts)
**No changes required:** The server-side transformer configuration remains the same in v11.

```typescript
const t = initTRPC.context<Context>().create({
  transformer: superjson,
});
```

### 5. Next.js App Component (src/pages/_app.tsx)
**Minor fix:** Updated type imports to work with newer Next.js versions.

**Before:**
```typescript
import type { AppProps } from 'next';
// ...
function MyApp({ Component, pageProps }: AppProps) {
  // ...
}
```

**After:**
```typescript
import type { NextPage } from 'next';
import { AppType } from 'next/app';
// ...
const MyApp: AppType = ({ Component, pageProps }) => {
  // ...
};
```

## Build Verification
✅ Build completed successfully
✅ No TypeScript errors
✅ All pages generated correctly

## Important Notes
1. The transformer must be defined on the server-side `initTRPC` object first
2. The client-side configuration requires the transformer at both the root level AND in the httpBatchLink
3. The `info` parameter in `createContext` provides access to `info.calls[0].getRawInput()` for pre-procedure input access
4. The context now includes `rawInput` which can be used in procedures via `ctx.rawInput`

## Files Modified
- package.json
- src/utils/trpc.ts
- src/server/context.ts
- src/pages/_app.tsx

## Files Unchanged
- src/server/routers.ts (no changes required)
- src/pages/api/trpc/[trpc].ts (no changes required)