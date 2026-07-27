# Saved Searches with New-Match Alerts (Typesense)

## Background
Build a web application that lets a user save named searches over a product catalog indexed in Typesense and, on demand, re-run each saved search to see how many documents currently match and how many of those matches are *new* since the last time that saved search was checked. A local Typesense server (v26.0) is already installed and reachable at `http://127.0.0.1:8108`.

## Requirements
- A browser UI that can:
  - Compose and save a *named* search made of three parts: a free-text query, an optional category filter, and an optional maximum price.
  - List every saved search, each showing its current match count and a "new matches" badge.
  - Trigger a "Check" for a single saved search and a "Check all" for every saved search.
  - Ingest new documents into the catalog, chosen from a provided ingest catalog.
- A JSON API that backs the UI (endpoints listed below).
- All match counts and new-match numbers MUST be derived from live queries against the real Typesense index (not from values tracked only inside the app).

## Domain / data
- Typesense server: `http://127.0.0.1:8108`, API key read from the file `/etc/typesense-api-key`.
- Collection name: `products`. Every product document has these fields: `id` (string), `name` (string), `category` (string), `price` (number).
- On startup the application MUST ensure the `products` collection exists and index every document listed in `/home/user/saved-search-alerts/data/baseline.json` (the baseline catalog). Indexing the same baseline more than once MUST NOT create duplicate documents.
- The ingest catalog is provided at `/home/user/saved-search-alerts/data/catalog.json`. These documents are NOT indexed until they are ingested. The UI must present each catalog document (showing at least its `name`) together with a control to ingest it.

## Matching semantics (what it means for a document to match a saved search)
A document matches a saved search when ALL of the following hold:
- the query text matches the document's `name` field (an empty query or the string `*` matches every document);
- if a category is set, the document's `category` equals that category exactly;
- if a maximum price is set, the document's `price` is less than or equal to that maximum.
The *match set* of a saved search is the set of ids of ALL matching documents (not only the first page of results).

## New-match semantics
- Each saved search remembers the exact set of matching document ids from the previous time it was checked.
- `new_count` is the number of documents in the current match set whose id was NOT present in that previously-recorded set.
- A saved search that has never been checked has no recorded set; its first check records the current match set and reports `new_count` = 0.
- Every check (including via "Check all") records the current match set, so an immediate re-check with no intervening index change reports `new_count` = 0.

## Implementation Hints
- Project path: /home/user/saved-search-alerts
- Start command (run inside the project path): `npm start`
- Port: 8080
- API endpoints (all request and response bodies are JSON):
  - `POST /api/saved-searches` — body `{ "name": string, "q": string, "category": string, "max_price": number|null }`. `category` may be `""` (meaning no category filter) and `max_price` may be `null` (meaning no price cap). Returns HTTP 201 with the created saved search object.
  - `GET /api/saved-searches` — returns HTTP 200 with an array of saved search objects.
  - `POST /api/saved-searches/{id}/check` — re-checks a single saved search and returns HTTP 200 with that saved search object (with updated counts).
  - `POST /api/check-all` — checks every saved search and returns HTTP 200 with an array of saved search objects.
  - `POST /api/ingest` — body `{ "documents": [ { "id": string, "name": string, "category": string, "price": number }, ... ] }`. Upserts the given documents into the `products` collection (an id that already exists is updated in place, not duplicated). Returns HTTP 200 with `{ "ingested": number }`.
- A saved search object has exactly these keys: `id` (string), `name` (string), `q` (string), `category` (string), `max_price` (number|null), `match_count` (number|null), `new_count` (number|null). `match_count` and `new_count` are `null` before the first check and numbers afterward.
- UI: the saved-search list must render each saved search with its name, its current match count, and a visible "new" badge that shows its `new_count`; the ingest section must let a user pick provided catalog documents and ingest them. The match counts and new badges shown in the UI must reflect the values returned by the check endpoints.

