# Fix a Broken Qwik `server$` Streaming RPC Log Viewer

## Background
You are given an existing Qwik City application (Qwik `1.20.x`) that implements a "Live Log Stream" page. When the user clicks a button, the browser calls a server-side RPC (an async-generator `server$` function) that reads a local log file, parses it, and streams the parsed entries back to the client one at a time. The client is supposed to render each entry incrementally as it arrives and keep a running summary.

The feature is currently broken. The page and/or its interactivity fail at runtime: the streamed entries do not render, the running counts stay wrong, and the browser console reports errors. Your job is to make the streaming RPC and its client-side consumption work correctly, while keeping all file-system access and parsing strictly on the server.

## Requirements
- The app must build and run, and the page at `/` must load and become interactive without any runtime or console errors in the browser.
- Clicking the start button must invoke the server RPC and stream the log entries from the server to the browser, rendering each entry **incrementally** (entries appear one after another over time, not all at once at the very end and not all before the first).
- The single source of truth for the data is the local file `data/events.log`. Each non-empty line has the form `LEVEL|message` (for example `INFO|Server started`). Entries must be produced in file order, indexed starting at `0`.
- Each time streaming is started, the server must read the current on-disk contents of `data/events.log`, so that edits to the file are reflected on the next run (do not bake the file contents into the client or into a value captured once at module load).
- All file-system access and log parsing must execute **only on the server**. No server-only module may run in the browser.
- The running summary (total received count and ERROR-level count) must update live as entries arrive and be correct when streaming completes.
- Preserve the existing observable behavior, DOM structure, element ids, and status semantics described below; do not remove the streaming/incremental nature of the feature.

## Implementation Hints
- Project path: `/home/user/project`
- Start command: `npm run dev` (Vite SSR dev server; do not change the port)
- Port: `3000`
- Route under test: `GET http://localhost:3000/`
- The page MUST expose these elements with exactly these ids:
  - `#start`: the button that starts streaming.
  - `#status`: a text node whose value is exactly `idle` before starting, `streaming` while entries are still arriving, and `done` after the stream completes.
  - `#count`: a text node equal to the number of entries received so far (an integer, starting at `0`).
  - `#errors`: a text node equal to the number of received entries whose level is `ERROR`.
  - `#events`: a `<ul>` list. For each received entry append one `<li>` with attributes `data-idx` (the 0-based index) and `data-level` (the level), and text content in the exact form `LEVEL: message` (e.g. `INFO: Server started`). List items must be in ascending `data-idx` order with no gaps or duplicates.
- Each entry streamed from the server must be a plain, serializable value carrying at least its index, level, and message; the values received on the client must be usable directly to render the `<li>` text and attributes above.
- Do not introduce any external network calls, databases, or cloud services; everything runs locally.

