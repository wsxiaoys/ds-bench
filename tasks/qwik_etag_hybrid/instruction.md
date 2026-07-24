# Qwik City Hybrid Catalog: Content-Negotiated JSON API + SSR HTML with Strong ETags

## Background
Build a single Qwik City route that exposes the SAME product-catalog domain data in two representations from ONE URL using HTTP content negotiation: a JSON REST endpoint and a server-side-rendered HTML page. Both representations must be driven by the same server-only data layer backed by a local SQLite database, so business logic is not duplicated. This is a fullstack task built with Qwik (`@builder.io/qwik`) and Qwik City (`@builder.io/qwik-city`).

## Requirements
- Expose one route at path `/catalog` that performs content negotiation on the request `Accept` header, serving either JSON or server-rendered HTML for the same underlying data.
- The JSON representation must support strong ETags, conditional GET (`If-None-Match` -> `304`), correct `Cache-Control` and `Vary` response headers, and `406` for unsupported media types.
- The HTML representation must be server-side rendered and must report data that is byte-consistent with the JSON representation.
- A mutation endpoint (POST) must persist a new product and thereby change the JSON ETag.
- All catalog data-access logic must live in a single server-only module backed by a local SQLite database. This server-only code (including the sentinel string and all SQL) MUST be tree-shaken out of the client JavaScript bundle.
- Concurrent writes must all be persisted without loss or corruption.

## Implementation Hints
- Project path: /home/user/qwik-etag-hybrid
- Pinned dependencies: `@builder.io/qwik` and `@builder.io/qwik-city` at version `1.20.0`. Node.js 20+.
- Start command: `npm run preview` (this command MUST build the app and serve the production build).
- Port: 4173 (the server must listen on http://localhost:4173).
- Local SQLite database file: /home/user/qwik-etag-hybrid/data/catalog.db, containing a table named `products` with exactly one row per catalog product. Seed it with at least 3 products on first initialization; seeding MUST be idempotent (restarting the server must not duplicate seed rows).
- The server-only data module MUST contain the exact sentinel string `__CATALOG_SERVER_SECRET__`. This sentinel and all database/SQL code MUST NOT appear in any JavaScript file of the built client bundle (the client build output directory `dist/`).

### Route `/catalog`

`GET /catalog` performs content negotiation on the `Accept` header:
- If `Accept` includes `application/json` -> return the JSON representation.
- Else if `Accept` includes `text/html` or `*/*` -> return the HTML representation.
- Otherwise (e.g. `application/xml`) -> respond `406`.

**JSON representation** (`GET /catalog` with `Accept: application/json`) -> `200` with a body of exactly this shape:

```json
{
  "products": [
    { "id": <integer>, "name": <string>, "priceCents": <integer>, "stock": <integer> }
  ]
}
```

- `products` MUST be ordered by `id` ascending.
- The response body MUST be deterministic: identical bytes whenever the underlying data is unchanged (no timestamps or other volatile fields).
- Response headers MUST include: `Content-Type: application/json` (a charset is allowed); a strong `ETag` (double-quoted and NOT prefixed with `W/`) derived from the JSON body bytes; `Cache-Control: no-cache`; and `Vary: Accept`.

**Conditional GET** (`GET /catalog` with `Accept: application/json` and `If-None-Match` equal to the current ETag) -> `304` with an empty body; the `304` response MUST still include the matching `ETag` and `Vary: Accept`.

**HTML representation** (`GET /catalog` with `Accept: text/html`) -> `200` with `Content-Type: text/html`. The page MUST visibly render every product's `name`, and MUST contain an element `<script type="application/json" id="catalog-data">` whose text content is byte-identical to the JSON body returned by the JSON representation for the same data.

`POST /catalog` creates a product. Request `Content-Type: application/json`, body:

```json
{ "name": <string>, "priceCents": <integer>, "stock": <integer> }
```

- On success -> `201` with body `{ "id": <integer>, "name": <string>, "priceCents": <integer>, "stock": <integer> }`, where `id` is assigned by the server (any client-supplied `id` MUST be ignored).
- The created product MUST be persisted so that subsequent GETs (both JSON and HTML) include it, and the JSON ETag MUST change.
- Validation: `name` must be a non-empty string, `priceCents` a non-negative integer, and `stock` a non-negative integer. Any invalid body -> `400`.
- Concurrent POST requests must all be persisted with no lost writes.

