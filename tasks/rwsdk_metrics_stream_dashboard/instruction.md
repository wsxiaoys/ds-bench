# Live Server-Driven Metrics Dashboard with Threshold Alerts (RedwoodSDK)

## Background
You are working inside an existing **RedwoodSDK (rwsdk)** application located at `/home/user/app`. RedwoodSDK is a server-first React framework that runs on Cloudflare's local runtime through a Vite dev server. Your job is to build a live, server-driven metrics dashboard whose numeric "tick" stream is generated on the server and observed identically by every connected browser.

The hard part is that the metric **producer must live on the server and be shared by all clients**: every browser that opens the dashboard must see the exact same stream of ticks (same sequence numbers and same values), the stream must keep advancing on its own once started (independent of any single browser), and the recent history must survive a full page reload.

## Requirements
Build a page served at `/metrics` that provides:

- **A shared, server-driven producer.** When started, the server emits a new numeric tick approximately once per second and makes it visible to every connected client. Each tick has a strictly increasing integer sequence number `seq` (starting at 1, incrementing by exactly 1 per tick, never reused) and an integer `value` in the inclusive range 1..100 chosen on the server. Production must be driven by the server itself: after it is started it must continue to advance even if the browser that started it is closed, and it must stop only when explicitly stopped. It must not depend on any client-side timer, external service, external API, or any process outside the app.
- **Start / stop controls** that turn the shared producer on and off for all clients.
- **Live widgets** showing the current (latest) value, the running tick count, the running minimum and maximum of all values emitted this session, an alert counter, and a scrolling history of recent ticks.
- **Threshold alerts.** A numeric threshold can be applied at runtime. Every tick emitted *after* a threshold is applied whose value is strictly greater than the current threshold is an "alert": that tick is marked as an alert, and the alert counter increases by 1. Ticks that were emitted before the threshold was applied are never retroactively re-classified. While the latest value is strictly greater than the current threshold, the current-value widget is marked as over-threshold.
- **Persistence.** Recent tick history and the running counters must be persisted to the app's local Cloudflare-backed durable storage so that reloading the page restores the recent history list and the counters (tick count, min, max, alert count) rather than starting from scratch.

## Implementation Hints
- Project path: `/home/user/app`
- Start command: `npm run dev` (a Vite dev server on Cloudflare's local runtime). Port: `5173`.
- The dashboard route is exactly `GET /metrics`.
- Build this inside the provided RedwoodSDK project and run it through `npm run dev`. Do NOT introduce any separate long-running Node process, external database server, message broker, cron service, or any third-party/network API. All state must live in the app's local Cloudflare runtime (locally emulated).
- All controls and interactivity must actually work in a real browser (the page must ship and hydrate its client entry so buttons respond to clicks).
- The producer, its counters, the threshold, and the history are **global/shared**: starting, stopping, and applying a threshold from one browser affects the stream seen by every browser, and two browsers open at `/metrics` must observe identical `seq`→`value` pairs and identical tick counts.
- Tick cadence must be roughly one tick per second while running (on average no faster than ~2 ticks/second). The history list must retain at least the 50 most recent ticks.
- Expose the UI with these exact stable selectors (attributes must be literally these strings):
  - Controls: `data-testid="start-stream"` (button), `data-testid="stop-stream"` (button), `data-testid="threshold-input"` (a numeric input), `data-testid="apply-threshold"` (button).
  - Widgets: `data-testid="current-value"`, `data-testid="tick-count"`, `data-testid="min-value"`, `data-testid="max-value"`, `data-testid="alert-count"`, and `data-testid="history"` (the container of recent ticks).
  - Each tick in the history container is its own element with `data-testid="tick-<seq>"` (for example `tick-1`, `tick-2`, ...). Every tick element must also carry `data-seq="<seq>"` (its integer sequence number) and `data-value="<value>"` (its integer value). A tick element that is an alert must carry `data-alert="true"`; non-alert ticks must not have `data-alert="true"`.
  - The text content of `current-value` must be the latest tick's integer value; `tick-count` must be the integer number of ticks emitted so far; `min-value`/`max-value` must be the integer min/max of all emitted values this session; `alert-count` must be the integer number of alert ticks so far.
  - While the latest value is strictly greater than the current threshold, the `current-value` element must carry attribute `data-over="true"`; otherwise it must not carry `data-over="true"`.
- Before the first tick is emitted, `tick-count`, `alert-count` must read `0` and the history must be empty. There is no active threshold until `apply-threshold` is pressed (so no alerts occur before then).

