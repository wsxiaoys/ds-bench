# Real-time Collaborative Counter with RedwoodSDK

## Background
A freshly scaffolded RedwoodSDK (rwsdk) project lives at `/home/user/myproject` with all npm dependencies pre-installed. Your job is to turn it into a real-time collaborative counter web app using rwsdk's `useSyncedState` hook (backed by a Cloudflare Durable Object), running locally on Vite + miniflare.

## Requirements
- A page at `/` that displays the current count and provides an **Increment** button and a **Decrement** button.
- Counter state must be synchronized in real time across all browser tabs viewing the page using `useSyncedState` from `rwsdk/use-synced-state/client`.
- Counter state must be scoped per evaluation run using the `ZEALT_RUN_ID` environment variable as the room ID (so concurrent runs do not collide).
- A JSON endpoint at `GET /api/count` that returns the current count as `{"count": <number>}`.

## Implementation Hints
- Wire up rwsdk's realtime primitives: export the `SyncedStateServer` Durable Object from the worker entry, register `syncedStateRoutes`, and declare the Durable Object binding plus the `new_sqlite_classes` migration in `wrangler.jsonc`.
- Because rwsdk is server-first, remember to include `<script type="module" src="/src/client.tsx"></script>` in the `Document` so client components are hydrated; otherwise the buttons will not work.
- The counter component is a client component (`"use client"`); the page is a server component that reads `ZEALT_RUN_ID` from the worker env and passes it as a prop (used as the third argument / room ID to `useSyncedState`).
- Workers do not expose `process.env`; the `ZEALT_RUN_ID` shell variable must be propagated into the worker `env` (e.g., via a `.dev.vars` file or wrangler `vars`).
- For the `/api/count` endpoint, the worker needs read access to the latest synced value. The `SyncedStateServer` exposes hooks for that purpose; consult the rwsdk Realtime docs for the appropriate handler.
- Bind the dev server to `0.0.0.0:5173` so it is reachable on `localhost:5173` from outside Vite's default loopback binding.

## Acceptance Criteria
- Project path: `/home/user/myproject`
- Start command: `npm run dev -- --host 0.0.0.0 --port 5173`
- Port: `5173`
- The room ID used by `useSyncedState` must equal the value of the `ZEALT_RUN_ID` environment variable available at server startup. The initial count is `0`.
- API endpoints:
  - `GET /` returns a `200 OK` HTML response containing the counter UI: a visible numeric count display, an **Increment** button, and a **Decrement** button. After client hydration, clicking the buttons must update the displayed count without a full page reload.
  - `GET /api/count` returns `200 OK` with `Content-Type: application/json` and a JSON body of the shape:
    ```json
    { "count": number }
    ```
    The `count` value must reflect the latest synchronized counter value, including updates made from the browser UI.
- Real-time behaviour: when two browsers/tabs have `/` open at the same time and one tab clicks **Increment** (or **Decrement**), the count displayed in the other tab must update automatically (without a manual page refresh) within a few seconds.
- Persistence within a run: while the dev server is running, the count value persists across page reloads (refreshing `/` after several increments must show the same value).
- The Durable Object class `SyncedStateServer` must be exported from the worker entry, bound in `wrangler.jsonc`, and migrated via a `new_sqlite_classes` entry. The `Document` must include a `<script type="module" src="/src/client.tsx">` tag so the page is hydrated on the client.

