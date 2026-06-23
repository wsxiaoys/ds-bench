# tRPC v10 → v11 Migration Summary

## Project
`/home/user/app` — Next.js 14 application using tRPC.

## Result
✅ Build succeeds (`npm run build`).
- All four `@trpc/*` packages upgraded from v10.45.x to v11.13.0 (via `@next` dist-tag).
- `@tanstack/react-query` upgraded from v4.36.1 to v5.100.6 (`latest`).

## Changes

### 1. `package.json`
Bumped tRPC packages to `next` (resolves to v11) and react-query to `latest` (resolves to v5).

```jsonc
{
  "dependencies": {
    "@tanstack/react-query": "latest",
    "@trpc/client": "next",
    "@trpc/next": "next",
    "@trpc/react-query": "next",
    "@trpc/server": "next",
    ...
  }
}
```

### 2. `src/utils/trpc.ts`
v11 moves the `transformer` from the root config object onto each link. For
`createTRPCNext` we also pass a top-level `transformer` so the typed router
knows that a transformer is in use (matching the new
`TransformerOptions<inferClientTypes<TRouter>>` constraint).

```ts
export const trpc = createTRPCNext<AppRouter>({
  config(opts) {
    return {
      links: [
        httpBatchLink({
          url: `${getBaseUrl()}/api/trpc`,
          transformer: superjson, // moved here
        }),
      ],
    };
  },
  transformer: superjson, // required by the new top-level type
  ssr: false,
});
```

### 3. `src/server/context.ts`
v11 changes the shape of `CreateNextContextOptions` (now
`NodeHTTPCreateContextFnOptions<NextApiRequest, NextApiResponse>`) and exposes
a `info: TRPCRequestInfo` field. The procedure input is no longer accessible
directly from `createContext`; instead, you must consult
`info.calls[0].getRawInput()` to read the raw request payload before the
procedure runs. The deprecated `inferAsyncReturnType` helper is replaced with
`Awaited<ReturnType<…>>`.

```ts
import type { CreateNextContextOptions } from '@trpc/server/adapters/next';

export async function createContext(opts: CreateNextContextOptions) {
  const rawInput = opts.info.calls[0]
    ? await opts.info.calls[0].getRawInput()
    : undefined;

  return {
    req: opts.req,
    res: opts.res,
    rawInput,
  };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
```

### 4. `src/pages/_app.tsx` (incidental fix)
`AppProps` is exported from `next/app`, not from `next`. This was a
pre-existing typing issue surfaced by the upgrade.

```ts
import type { AppProps } from 'next/app';
```

## Verification
```
$ cd /home/user/app && npm run build
▲ Next.js 14.2.3
✓ Compiled successfully
✓ Generating static pages (3/3)
```
