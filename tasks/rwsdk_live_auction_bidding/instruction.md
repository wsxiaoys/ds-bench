# Live Auction Room (RedwoodSDK)

## Background
Build a real-time auction room with **RedwoodSDK (rwsdk)** — a server-first React framework for Cloudflare that runs as a Vite plugin and provides React Server Components, Server Functions, Durable-Object-backed realtime shared state, Durable Object lifecycle/timers, and a locally-emulated database. Everything in this task runs locally against the emulated Cloudflare runtime; **no external service, API key, email, or SaaS may be used**, and the countdown/auto-close must be driven locally (server time / the local runtime), never by an external timer service.

## Requirements
- Render an auction room at the route `/auction/:itemId`. The route must serve an auction room for any item id; opening any id begins that id's auction independently.
- The item id `lot-42` must be configured specifically as follows (it must always be reachable at `/auction/lot-42`):
  - name: `Sunburst Electric Guitar`
  - starting price: `50` dollars
  - auction duration: `25` seconds
  - (Other item ids may use any default name and starting price; only `lot-42`'s values are checked.)
- The room displays: the item name, the current highest bid (in whole dollars), the current highest bidder, a live countdown of whole seconds remaining, and the viewing client's own identity.
- A client's identity comes from the `name` query parameter (e.g. `/auction/lot-42?name=Alice`). When absent, the identity is `Anonymous`.
- Bidding UI: a numeric input plus a submit control. When a client submits a bid that is accepted, that bidding client's identity is recorded as the new highest bidder.
- **Server-enforced bid validation:** a bid is accepted only if it is BOTH (a) greater than or equal to the item's starting price AND (b) strictly greater than the current highest bid. Before any bid has been accepted there is no current highest bid, so only rule (a) applies. A rejected bid must not change any auction state (highest bid, highest bidder, or countdown) and must surface an error to the bidding client. Validation must be authoritative on the server; a client must not be able to bypass it by supplying its own values.
- **Real-time propagation:** an accepted bid placed in one open client must update the current highest bid and the highest bidder in every other open client that is viewing the same item, without a page reload.
- **Countdown & auto-close:** the countdown begins when the auction room for an item is first opened and decreases by one each second down to 0. All clients viewing the same item observe the same countdown and the same close moment. When the countdown reaches 0 the auction closes automatically, with **no user interaction required**: within about 2 seconds every open client must (1) disable the bid submit control and (2) show a winner banner naming the winning bidder and the winning amount. The winner is the highest bidder at the moment of close.
- **Persistence:** the closed result (winning bidder, winning amount, and closed status) must be persisted to a local database so that loading `/auction/lot-42` after the auction has closed — including from a brand-new browser session with no prior cookies/local storage — still shows the winner banner and keeps bidding disabled.
- Distinct `:itemId` values are fully independent auctions (separate state, countdown, and result).

## Implementation Hints
These are the exact, unguessable contract facts the automated tests rely on. They constrain WHAT the result must look like; the approach is entirely up to you.
- Project path: `/home/user/auction`
- Start command: `npm run dev` (run from the project path)
- Port: `5173` — the app must be reachable at `http://localhost:5173`
- Route pattern: `/auction/:itemId`; the seeded item id is `lot-42`.
- The HTML document must include the client hydration entry script so that interactive components actually hydrate in the browser.
- Attach `data-testid` attributes with these exact values to the corresponding elements:
  - `item-name` — the item's name.
  - `my-name` — the viewing client's identity (from `?name=`).
  - `current-bid` — the current highest bid as an integer dollar amount (digits only; a leading `$` is allowed). Before any accepted bid it shows the starting price.
  - `high-bidder` — the name of the current highest bidder. Before any accepted bid it may be empty or a placeholder.
  - `time-left` — the whole seconds remaining, as an integer (a trailing unit such as `s` is allowed).
  - `bid-input` — the numeric bid input control.
  - `place-bid` — the submit control; it must carry the HTML `disabled` state once (and only once) the auction is closed.
  - `bid-error` — present/visible only when the most recently submitted bid was rejected.
  - `winner` — present/visible only after the auction closes; its text must contain BOTH the winning bidder's name AND the winning amount as an integer dollar value.
- All monetary amounts are whole dollars (no cents).

### RedwoodSDK realtime & wiring notes (the approach is up to you)
- Live cross-client updates are built in: the `useSyncedState` hook from `rwsdk/use-synced-state/client` behaves like `useState` but syncs through a Cloudflare Durable Object, so a change in one client is pushed to every other connected client sharing the same key. Pass a room/scope id as the third argument to isolate state per URL segment (per `itemId` here).
- Enabling realtime has a setup step that, if skipped, makes it fail silently (a common time sink): in `src/worker.tsx` `export { SyncedStateServer }` and spread `syncedStateRoutes(() => env.SYNCED_STATE_SERVER)` (both from `rwsdk/use-synced-state/worker`) into `defineApp`; in `wrangler.jsonc` add a `durable_objects` binding for `SyncedStateServer` plus a `migrations` entry with `"new_sqlite_classes": ["SyncedStateServer"]`; then run `npm run generate`. If the realtime primitive needs a peer package (e.g. `capnweb`) that is not installed yet, install it.
- Bid validation must be authoritative on the server (a Server Function or Durable Object method) — never trust client-supplied amounts. Persist the closed result to the local DB so a brand-new session still sees the winner banner and disabled bidding.
- The countdown/auto-close must keep running independently of any client (it must fire even if every browser closes): drive it from the server — e.g. a Durable Object `alarm()` that reschedules itself each second — not from a browser timer.
- RedwoodSDK is server-first: the served `Document` must include the client entry (`<script>import("/src/client.tsx")</script>` or equivalent) or nothing hydrates and the controls stay dead.

