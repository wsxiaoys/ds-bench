# tRPC v11 File Upload with Native FormData

A minimal Next.js 15 (App Router) application demonstrating tRPC v11's native
`FormData` support for file uploads.

## Project Layout

```
/home/user/project
├── app
│   ├── api/trpc/[trpc]/route.ts   # tRPC fetch handler (App Router)
│   ├── uploads/[filename]/route.ts# Serves files saved at runtime
│   ├── layout.tsx
│   ├── page.tsx                   # Upload form (client component)
│   ├── providers.tsx              # tRPC + React Query providers
│   └── globals.css
├── server
│   ├── trpc.ts                    # initTRPC instance
│   └── routers/_app.ts            # `uploadFile` mutation
├── utils/trpc.ts                  # createTRPCReact<AppRouter>()
├── public/uploads/                # Saved uploads
├── next.config.js
├── tsconfig.json
└── package.json
```

## Key Pieces

### Server – `server/routers/_app.ts`

Uses `zod-form-data` to validate `FormData` directly:

```ts
uploadFile: publicProcedure
  .input(zfd.formData({ file: zfd.file() }))
  .mutation(async ({ input }) => {
    const buffer = Buffer.from(await input.file.arrayBuffer());
    await fs.writeFile(filePath, buffer);
    return { url: `/uploads/${filename}`, ... };
  })
```

### Client – `app/providers.tsx`

A `splitLink` routes `FormData`/`Blob`/`Uint8Array` inputs through
`httpLink` (non-batching, raw body) and everything else through the
batching `httpBatchLink`. This is the recommended setup for tRPC v11
FormData support.

### Client – `app/page.tsx`

```tsx
const formData = new FormData();
formData.append('file', file);
uploadFile.mutate(formData);
```

The mutation result is used to display the uploaded image.

### Static file delivery – `app/uploads/[filename]/route.ts`

Next.js only serves files that existed in `public/` at build time.
Because uploads are written to `public/uploads/` at runtime, a tiny
dynamic route reads the file from disk and returns it with the
appropriate `Content-Type`.

## Build / Run

```bash
cd /home/user/project
npm run build && npm start  # serves on http://localhost:3000
```

## Manual Verification

```bash
# Upload a file:
curl -X POST -F file=@/home/user/test-image.png \
     http://localhost:3000/api/trpc/uploadFile
# => {"result":{"data":{"ok":true,"url":"/uploads/<ts>-test-image.png", ...}}}

# Fetch the uploaded image:
curl -I http://localhost:3000/uploads/<ts>-test-image.png
# => HTTP/1.1 200 OK; Content-Type: image/png
```

Both checks pass with the application running.

## Dependencies

- `next@15.0.3`
- `react@^18.3.1`, `react-dom@^18.3.1`
- `@trpc/server`, `@trpc/client`, `@trpc/react-query` `@11.0.0-rc.553`
- `@tanstack/react-query@^5.59.0`
- `zod@^3.23.8`, `zod-form-data@^2.0.2`
