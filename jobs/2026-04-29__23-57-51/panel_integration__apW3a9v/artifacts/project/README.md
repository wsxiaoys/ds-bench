# tRPC v11 + trpc-panel Integration

## Setup

```bash
cd /home/user/project
npm install   # uses --legacy-peer-deps due to trpc-panel's peer dep on @trpc/server ^10
node index.js
```

## Endpoints

| Endpoint | Description |
|---|---|
| `GET /panel` | trpc-panel UI (auto-generated docs/testing interface) |
| `/trpc/*` | tRPC v11 API |

## Example tRPC call

```
GET http://localhost:3000/trpc/greeting?input={"name":"World"}
→ {"result":{"data":{"message":"Hello, World!"}}}
```

## Key notes

- `trpc-panel@1.3.4` declares `@trpc/server@^10` as a peer dep, but works at runtime with v11.
- Install with `--legacy-peer-deps` to bypass the peer-dep conflict.
- `initTRPC.create()` replaces the v10 `initTRPC()` call; `t.procedure` is the public procedure builder.
- `createExpressMiddleware` from `@trpc/server/adapters/express` is unchanged from v10.
- `renderTrpcPanel(appRouter, { url: '...' })` returns an HTML string served directly.
