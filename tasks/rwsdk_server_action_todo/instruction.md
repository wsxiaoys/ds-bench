# Server-Rendered Todo App with rwsdk `serverAction` and Cloudflare KV

## Background
Build a server-rendered Todo application powered by RedwoodSDK (rwsdk). The page at `/` must use plain HTML `<form>` submissions wired to `serverAction` functions imported from `rwsdk/worker`. After each form submit, the page must be re-rendered on the server with the updated state. Persistent state lives in a Cloudflare KV namespace bound as `TODOS`, which is available locally through miniflare.

## Requirements
- The home route `/` renders the entire Todo UI on the server (no `useState` / client-side fetch / `useEffect` data fetching).
  - The new-todo form must contain an `<input name="title" aria-label="New todo title">` and a submit `<button>` with text `Add`.
  - Each rendered todo row must have its visible text in an element with `data-testid="todo-title"`. Completed todos must have an ancestor element with `data-done="true"`, while not-yet-completed ones have `data-done="false"`.
  - The remaining count must be displayed in an element with `data-testid="remaining-count"`.
- Provide three mutations, each wired to its own `<form action={...}>`:
  - Add a new todo.
  - Toggle a todo's `done` state: use a form containing `<input type="checkbox" name="done" aria-label="Toggle <title>">` (e.g., `Toggle Buy milk`) that submits on change.
  - Delete a todo: use a form containing a submit `<button aria-label="Delete <title>">`.
- Display the list of todos and the count of *remaining* (unchecked) todos.
- Persist state in the Cloudflare KV binding `TODOS` (configured in `wrangler.jsonc`), keyed under the prefix `todo:` (one KV entry per todo). The KV value must be a JSON object with the shape `{"id": string, "title": string, "done": boolean, "createdAt": number}`.
- Expose a read-only JSON endpoint `GET /api/todos` that returns all todos for inspection. The response must be `{ "todos": [...], "remaining": number }` where `todos` are sorted by `createdAt` ascending and match the KV value shape.

## Implementation Hints
- Read the official rwsdk docs on React Server Components and `serverAction`: https://docs.rwsdk.com/core/react-server-components
- `serverAction` and `serverQuery` live in `rwsdk/worker`. Access the KV binding through `env` from `cloudflare:workers` (or `requestInfo.cf.env`).
- For each todo, generate a stable ID (e.g., `crypto.randomUUID()`) and store the JSON-serialized value under the key `todo:<id>`.
- A `serverAction` triggers a full server re-render of the current page, so the UI naturally reflects the new KV state after each submission. No client-side state management is required.
- Component files containing JSX that uses a server action via `<form action={...}>` must be marked with the `"use client"` directive (per the RSC docs). The action module itself should be `"use server"`.
- Configure a local KV namespace in `wrangler.jsonc` with the binding `TODOS`. Miniflare will allocate a fresh KV store per container at startup.
- Run the dev server with `npm run dev`. It must listen on port `5173` and be reachable on `0.0.0.0`.

