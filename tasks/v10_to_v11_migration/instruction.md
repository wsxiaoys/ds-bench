# Migrate tRPC v10 to v11

## Background
You have a Next.js project using tRPC v10 at `/home/user/project`. You need to upgrade it to tRPC v11, which introduces breaking changes to how transformers are configured.

## Requirements
1. Upgrade tRPC dependencies to v11 (`@trpc/server@next`, `@trpc/client@next`, `@trpc/react-query@next`, `@trpc/next@next`) and `@tanstack/react-query@latest`.
2. In `src/utils/trpc.ts`, migrate the `transformer` configuration from the root of the client initialization to inside the `httpBatchLink`.

## Constraints
- Project path: `/home/user/project`
- Start command: `npm run dev`
- Port: 3000