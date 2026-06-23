# tRPC v11 + Next.js Server Actions – Artifact Summary

## Project location
`/home/user/project`

## Start the dev server
```bash
cd /home/user/project
npm run dev        # http://localhost:3000
```

## File map

| File | Purpose |
|------|---------|
| `src/server/trpc.ts` | tRPC initialisation, `appRouter`, `addMessage` mutation, `createCaller` export |
| `src/app/actions.ts` | Next.js Server Action – uses `createCallerFactory` to invoke `addMessage` |
| `src/app/MessageForm.tsx` | `"use client"` form component – calls the Server Action, displays result |
| `src/app/page.tsx` | Server Component page that composes `MessageForm` |

## Data flow

```
Browser (MessageForm)
  │  submit form
  ▼
Server Action: addMessage(text)          ← "use server"
  │  createCaller({})
  ▼
tRPC appRouter.addMessage({ text })      ← server-only, no HTTP
  │  returns { success: true, message }
  ▼
Client receives result → displays it
```

## Key decisions

* **`createCallerFactory`** – tRPC v11 API for server-side direct calls,
  replacing the old `createServerSideHelpers` pattern.
* **No `@trpc/react-query` on the client** – the mutation goes via a plain
  Server Action, so no TanStack Query wiring is needed on this page.
  The package is installed for future client-side usage if required.
* **Zod v4** – input validated with `z.object({ text: z.string().min(1) })`.
