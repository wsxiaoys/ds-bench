# tRPC v11 Transformer Configuration

## Background
tRPC v11 introduced a breaking change where transformers (like `superjson`) must be defined directly within the links array rather than the root client configuration. This frequently causes serialization errors during migrations from v10.

## Requirements
- Fix the tRPC client initialization in `client/trpc.ts` by moving the `superjson` transformer configuration.
- Properly place the transformer inside the `httpBatchLink` configuration object to ensure Date objects and complex types are successfully parsed on the client.

## Constraints
- Project path: `/home/user/project`
- Do NOT modify the server-side router configuration in `server/router.ts`.
- The client must use `httpBatchLink` as the primary link.
- Log file: `/home/user/project/output.log`