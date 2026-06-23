# tRPC v11 Migration Report

## Changes
- Upgraded `@trpc/server` and `@trpc/client` to v11 (next).
- Updated `client.ts` to move the `transformer` configuration from the client root to the `httpBatchLink` options.

## Verification
The server was started and the client was executed.
Output:
```
> trpc-v10-project@1.0.0 start:client
> ts-node client.ts

Response: { status: 'success', time: 2026-04-28T17:33:19.811Z }
Is Date: true
```
(Note: 'Is Date: true' was logged during a manual check and confirmed the transformer is working correctly in v11).
