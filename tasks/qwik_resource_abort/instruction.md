# Debounced Async Search with Race-Safe `useResource$` in Qwik

## Background
You are building a type-ahead search feature for a Qwik City application (Qwik `1.11.x`). The search box queries a **local** JSON endpoint that intentionally behaves like a slow, flaky backend. Because keystrokes arrive faster than the backend responds, a naive implementation suffers from a classic race condition: a slow response for an old query can arrive *after* a fast response for a newer query and overwrite the correct results. Your implementation must be correct under this condition.

Everything runs locally. There is **no** external network, cloud, API, or third-party service involved.

## Requirements

### 1. Local JSON search endpoint
Expose an HTTP GET endpoint at `/api/search` that searches a **fixed, hard-coded, in-memory dataset** (defined below). It reads a single query-string parameter `q`.

The endpoint MUST behave exactly as follows (evaluate the parameter after trimming leading/trailing whitespace from `q`):
- If `q` is missing/empty, or its trimmed length is **less than 2**, respond `400` with JSON body `{"error": "query must be at least 2 characters"}`.
- If the trimmed length is **greater than 50**, respond `400` with JSON body `{"error": "query must be at most 50 characters"}`.
- If the trimmed, lower-cased value equals `boom`, respond `500` with JSON body `{"error": "internal server error"}`. (This special query exists to exercise the error UI.)
- Otherwise respond `200` with a JSON body of shape:
  ```json
  {
    "query": string,
    "count": number,
    "results": [ { "id": number, "name": string } ]
  }
  ```
  where `query` is the trimmed query, `results` contains every dataset entry whose `name` contains the trimmed query as a **case-insensitive substring**, ordered by **ascending `id`**, and `count` equals `results.length`.

**Artificial latency (required):** before sending any `200` or `500` response, the endpoint MUST wait `Math.max(120, 1600 - (len - 2) * 500)` milliseconds, where `len` is the trimmed query length. (So a 2-character query takes ~1600 ms, a 3-character query ~1100 ms, a 4-character query ~600 ms, and any query of 5+ characters ~120 ms. Shorter queries are deliberately slower.) `400` validation responses may be returned immediately.

**Fixed dataset** (use these exact `id`/`name` pairs, in this order):
```
1  Java
2  JavaScript
3  Jasmine
4  Python
5  Ruby
6  Rust
7  Go
8  Kotlin
9  Scala
10 TypeScript
11 C
12 C++
13 C#
14 Haskell
15 Elixir
16 Erlang
17 Perl
18 PHP
19 Swift
20 Dart
```

### 2. The search page (`/`)
The application's index route `/` MUST render an interactive search component with the following observable, testable contract:
- A text `<input>` carrying the attribute `data-testid="search-input"`.
- User input MUST be **debounced by 300 ms**: the search only reacts to the query value after typing has paused for 300 ms.
- Data fetching MUST be performed with Qwik's async resource primitive rendered through the `<Resource>` component, tracking the debounced query. It must render three distinct states:
  - **Pending:** while a request is in flight, render an element with `data-testid="search-pending"`.
  - **Resolved:** render a container with `data-testid="search-results"`. Inside it, render one element per result carrying `data-testid="search-result-item"` whose text content is the result's `name`.
  - **Rejected:** when the request fails (e.g. the endpoint returns `500`), render an element with `data-testid="search-error"`.
- When the debounced query has **fewer than 2 characters** (including empty), the component MUST render **neither** results **nor** an error state (it is idle).

### 3. Race-condition correctness (the hard part)
When the query changes while a previous request is still in flight, the stale in-flight request MUST be cancelled so that its late response can **never** overwrite the results of the newest query. After rapid typing settles on a final query, the UI MUST show **only** results consistent with that final query, regardless of the endpoint's inverted latency.

## Implementation Hints
- Project path: `/home/user/qwik-search`.
- Qwik / Qwik City version: `1.11.x`.
- Start command: `npm run dev -- --port 3000 --host 0.0.0.0` (the grader runs this exact command from the project path).
- Port: `3000`. The search page MUST be served at `http://localhost:3000/` and the endpoint at `http://localhost:3000/api/search`.
- The endpoint, dataset, validation, status codes, JSON shapes, latency formula, and `data-testid` hooks above are all part of the required contract and are asserted verbatim.
- All data is local and hard-coded; do not call any external service.

