# Fix the Qwik Serialization-Boundary Failures in the "Keyword Tally" App

## Background
You are given an existing, broken Qwik City application named **Keyword Tally**, pinned to Qwik `1.15.0` (`@builder.io/qwik` and `@builder.io/qwik-city`). The project is configured to build a static site, so pages are server-rendered and their resumable state is serialized at build time.

The app currently **fails to build**. The page component at `src/routes/index.tsx` captures several non-serializable values across Qwik's `$` (lazy-loading) boundary, so the optimizer/serializer rejects it. Your job is to make the application build and run correctly **while preserving the exact functional contract described below**. This is a debugging/refactoring task: you must diagnose why serialization fails and restructure the component so it works, without weakening or changing the observable behavior.

## Requirements
- `npm run build` must complete successfully (it currently exits non-zero).
- The built app must be servable with `npm run preview` and must reproduce the exact page contract below.
- You may restructure the component internals in any way you choose, but you MUST NOT change the observable contract: the route, the port, the keyword set, the `data-testid` hooks, the text formats, or the runtime behavior.

## Implementation Hints
- Project path: `/home/user/keyword-tally`
- Build command: `npm run build` (must exit `0`).
- Start command: `npm run preview` (serves the already-built site).
- Port: `3000`.
- The page is served at path `/`.
- The keyword set is exactly, in this order: `alpha`, `beta`, `gamma`, `delta`. Do not add, remove, or reorder keywords.
- The browser-only utility class in `src/lib/activity-recorder.ts` throws if constructed outside a browser; it must never be instantiated during server rendering. You may edit any project file, but this class must remain a browser-only recorder that tracks the number of recorded events for the current page session.
- The page MUST expose the following elements (located by their `data-testid` attribute) whose **visible text matches these formats EXACTLY**:
  - One button per keyword with `data-testid="btn-<keyword>"` (e.g. `btn-alpha`). Its visible text MUST be exactly `<keyword>: <count>` (for example `alpha: 0`), where `<count>` is that keyword's current tally.
  - `data-testid="total"` with text exactly `Total: <n>`, where `<n>` is the sum of all keyword tallies.
  - `data-testid="touched"` with text exactly `Touched: <n>`, where `<n>` is the number of distinct keywords whose tally is at least `1`.
  - `data-testid="recorder-status"` with text exactly `idle` in the server-rendered HTML, and exactly `recording` once the page has become active in the browser.
  - `data-testid="log-count"` with text exactly `Events: <n>`, where `<n>` is the number of button clicks recorded by the in-browser activity recorder since the page became active.
- Behavior contract (must be preserved exactly):
  - On first load every tally is `0`, `Total` is `0`, `Touched` is `0`, and `Events` is `0`.
  - Clicking a keyword's button increments that keyword's tally by exactly `1` and records exactly one event.
  - `Total`, `Touched`, `Events`, and each button's own label MUST update reactively and reflect the correct state immediately after each click.
  - Clicks distribute independently per keyword; a keyword whose button is never clicked keeps tally `0` and is never counted in `Touched`.
- Do not change the `data-testid` values, the served port, the route, or the keyword set.

