# tRPC v11 Hello World — Next.js App Router

## Project Structure

```
/home/user/project/
├── server/
│   ├── trpc.ts                        # tRPC initialisation (router + publicProcedure)
│   └── routers/
│       └── _app.ts                    # appRouter with `hello` query procedure
├── app/
│   ├── api/
│   │   └── trpc/
│   │       └── [trpc]/
│   │           └── route.ts           # Next.js Route Handler using fetchRequestHandler
│   ├── Provider.tsx                   # Client-side QueryClient + trpc.Provider wrapper
│   ├── layout.tsx                     # Wraps children with <Provider>
│   └── page.tsx                       # Client Component: calls trpc.hello.useQuery('World')
├── utils/
│   └── trpc.ts                        # createTRPCReact<AppRouter>() client
└── package.json
```

## Key Dependencies
- `@trpc/server@next` (v11)
- `@trpc/client@next` (v11)
- `@trpc/react-query@next` (v11)
- `@tanstack/react-query@latest` (v5)
- `zod`

## Running
```bash
cd /home/user/project
npm run dev        # starts on http://localhost:3000
```

## API Verification
```
GET /api/trpc/hello?input="World"
→ {"result":{"data":"Hello World"}}
```
