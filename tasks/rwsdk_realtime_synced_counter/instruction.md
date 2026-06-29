# Real-time Collaborative Counter with RedwoodSDK

## Background
A freshly scaffolded RedwoodSDK (rwsdk) project lives at `/home/user/myproject` with all npm dependencies pre-installed. Your job is to turn it into a real-time collaborative counter web app using rwsdk's `useSyncedState` hook (backed by a Cloudflare Durable Object), running locally on Vite + miniflare.

## Requirements
- A page at `/` that displays the current count (initially `0`) and provides an **Increment** button and a **Decrement** button.
- Counter state must be synchronized in real time across all browser tabs viewing the page using `useSyncedState` from `rwsdk/use-synced-state/client`.
- Counter state must be scoped per evaluation run using the `/logs/artifacts/run-id` as the room ID (so concurrent runs do not collide).
- A JSON endpoint at `GET /api/count` that returns the current count as `{"count": <number>}`.

## Implementation Hints
- Wire up rwsdk's realtime primitives: export the `SyncedStateServer` Durable Object from the worker entry, register `syncedStateRoutes`, and declare the Durable Object binding plus the `new_sqlite_classes` migration in `wrangler.jsonc`.
- Because rwsdk is server-first, remember to include `<script type="module" src="/src/client.tsx"></script>` in the `Document` so client components are hydrated; otherwise the buttons will not work.
- The counter component is a client component (`"use client"`); the page is a server component that reads `/logs/artifacts/run-id` from the worker env and passes it as a prop (used as the third argument / room ID to `useSyncedState`).
- Workers do not expose `process.env`; the `/logs/artifacts/run-id` shell variable must be propagated into the worker `env` (e.g., via a `.dev.vars` file or wrangler `vars`).
- For the `/api/count` endpoint, the worker needs read access to the latest synced value. The `SyncedStateServer` exposes hooks for that purpose; consult the rwsdk Realtime docs for the appropriate handler.
- Bind the dev server to `0.0.0.0:5173` so it is reachable on `localhost:5173` from outside Vite's default loopback binding.

