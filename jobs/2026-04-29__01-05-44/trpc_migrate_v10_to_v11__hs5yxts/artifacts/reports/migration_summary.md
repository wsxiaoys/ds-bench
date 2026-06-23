# tRPC Migration Report (v10 to v11)

## Changes Made

### 1. Dependencies Upgrade
- Upgraded `@trpc/server`, `@trpc/client`, `@trpc/react-query`, and `@trpc/next` to v11 (specifically `11.17.0`).
- Upgraded `@tanstack/react-query` to v5 (specifically `5.100.6`).
- Fixed an issue in `src/pages/_app.tsx` where `AppProps` was imported from `next` instead of `next/app`, which caused build failures in Next.js 14.

### 2. Client Configuration (`src/utils/trpc.ts`)
- Moved the `transformer` from the `config` return object into the `httpBatchLink` options.
- Added `transformer` to the top level of `createTRPCNext` options to maintain type safety with the router.

### 3. Server Context (`src/server/context.ts`)
- Updated `createContext` to accept `CreateNextContextOptions`.
- Implemented `rawInput` extraction using `info.calls[0].getRawInput()`.
- Updated `Context` type definition to use `Awaited<ReturnType<typeof createContext>>`.

## Verification
- Ran `npm install --force` to ensure all dependencies are correctly resolved.
- Ran `npm run build` and confirmed the build completed successfully.
