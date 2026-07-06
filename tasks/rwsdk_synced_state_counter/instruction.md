# RedwoodSDK: Realtime Counter with useSyncedState

## Background
A RedwoodSDK project is pre-installed at `/home/user/myapp`. Build a globally shared counter using `useSyncedState` from `rwsdk/use-synced-state/client`, backed by RedwoodSDK's `SyncedStateServer` Durable Object.

## Requirements
- Update `wrangler.jsonc` to bind the `SyncedStateServer` Durable Object under the name `SYNCED_STATE_SERVER` and register the SQLite migration: `migrations: [{ tag: "v1", new_sqlite_classes: ["SyncedStateServer"] }]`.
- In `src/worker.tsx`, re-export `SyncedStateServer` from `rwsdk/use-synced-state/worker` so Cloudflare can find the Durable Object class, and register `syncedStateRoutes(() => env.SYNCED_STATE_SERVER)` inside `defineApp([...])`.
- Create a client component (`"use client"`) at `src/app/components/SharedCounter.tsx` that calls `useSyncedState(0, "counter")` and renders:
  - A `<p data-testid="counter-value">Count: {count}</p>` line.
  - A `<button data-testid="inc-btn">Increment</button>` button that calls `setCount((c) => c + 1)` on click.
  - A `<button data-testid="reset-btn">Reset</button>` button that calls `setCount(0)` on click.
- Implement `GET /counter` as a server route that renders a page including the `SharedCounter` client component.
- The development server can be started with `npm run dev -- --host 0.0.0.0 --port 5173` on port `5173`.

