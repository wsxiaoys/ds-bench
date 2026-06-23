# tRPC v11 Setup in Next.js App Router

## Files Created / Modified

| File | Purpose |
|------|---------|
| `src/server/trpc.ts` | tRPC initializer — exports `t`, `router`, `publicProcedure` |
| `src/server/routers/_app.ts` | App router — `hello` query with `z.string()` input, returns `"Hello <input>"` |
| `src/app/api/trpc/[trpc]/route.ts` | Next.js App Router route handler using `fetchRequestHandler` |
| `src/utils/trpc.ts` | `createTRPCReact<AppRouter>()` client |
| `src/app/Provider.tsx` | Client component wrapping app with `trpc.Provider` + `QueryClientProvider` |
| `src/app/layout.tsx` | Updated to wrap `{children}` with `<Provider>` |
| `src/app/page.tsx` | Client component calling `trpc.hello.useQuery('tRPC v11')`, renders result in `<div id="result">` |

## Verified API Response

```
GET /api/trpc/hello?input="tRPC v11"
→ {"result":{"data":"Hello tRPC v11"}}
```

## Key tRPC v11 API Notes

- `createTRPCReact` is imported from `@trpc/react-query`
- `httpBatchLink` is imported from `@trpc/client`
- `fetchRequestHandler` is imported from `@trpc/server/adapters/fetch`
- Zod v4 is used for input validation
