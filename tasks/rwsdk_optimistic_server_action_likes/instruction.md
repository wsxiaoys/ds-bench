# Persistent "Like" Button with a RedwoodSDK Server Action

## Background
You are working in an existing RedwoodSDK (rwsdk) project located at `/home/user/project`. RedwoodSDK is a server-first React framework for Cloudflare that supports React Server Components and Server Functions. Your job is to build a "Like" feature whose count survives page reloads by persisting to a Cloudflare D1 database.

The app is started with `npm run dev` and served at `http://localhost:5173`.

## Requirements
- On the home route `/`, render a page that displays the current number of likes.
- The displayed count must live inside an element carrying the attribute `data-testid="like-count"`, and the element's text content must be exactly the current integer count (e.g. `0`, `1`, `2`).
- Provide a clickable "Like" control carrying the attribute `data-testid="like-button"`.
- Clicking the "Like" control must invoke a RedwoodSDK **`serverAction`** that increments the persisted like count by exactly one and causes the page to re-render so the visible count reflects the new value without a manual reload.
- The like count must be persisted in a **Cloudflare D1** database and read back from that database when the page is rendered, so the value is retained across full page reloads and dev-server restarts.
- The count must start at `0` on a database that has never recorded a like.

## Implementation Hints
- Server Functions in RedwoodSDK must live in a file that starts with the `"use server"` directive; use the `serverAction` wrapper imported from `rwsdk/worker` for the mutation so the page re-renders after the action resolves.
- Interactivity (the button click) requires a Client Component marked with the `"use client"` directive, and Client Components are only hydrated if the `Document` includes the client entry script (`<script type="module" src="/src/client.tsx">`). A page that renders but never updates on click usually means hydration is missing.
- Access the D1 binding through Cloudflare's `env` (from `cloudflare:workers`) and use Drizzle ORM for schema and queries. Remember to declare the D1 binding in `wrangler.jsonc`, generate the SQL migration, and apply it locally before the count can be read or written.
- The home page is a Server Component, so it can read the current count directly from the database during render and pass it to the Client Component.

