# Inventory Stock Manager (Qwik City + SQLite)

## Background
Build a server-authoritative inventory/stock management page with **Qwik** (`@builder.io/qwik` and `@builder.io/qwik-city`, version 1.x, pinned in the provided project). Warehouse operators adjust stock levels by *receiving* or *shipping* units. The system must be transactionally safe: it must never let stock go negative, it must record **every** movement in an immutable append-only ledger, and it must always derive the current on-hand quantity by summing that ledger (never by trusting a stored counter).

A Qwik City project is already scaffolded and its dependencies are installed. A local SQLite database is already created and seeded. Your job is to implement the stock-management route.

## Requirements
- Implement the index route (`/`) so that:
  - A `routeLoader$` computes and renders the current on-hand quantity of every product. The quantity MUST be computed as the SUM of that product's `delta` values in the `stock_movements` ledger — it must never be read from a stored counter column.
  - A single `routeAction$` (submitted through a Qwik City `<Form>`) applies a stock movement.
- A movement submission carries three form fields:
  - `productId`: the integer id of an existing product.
  - `type`: either `receive` or `ship`.
  - `quantity`: a positive integer amount.
- On a valid **receive**, insert exactly one ledger row with `delta = +quantity`.
- On a valid **ship**, insert exactly one ledger row with `delta = -quantity`, but ONLY if the product currently has at least `quantity` units on hand.
- Reject (and record NO ledger row) any submission that: refers to a non-existent product, has a non-positive/non-integer quantity, or is a ship that would drive on-hand stock below zero. Rejections must return an action failure and re-render the page showing an error.
- The read-then-write of a ship MUST be atomic so that concurrent ship submissions can never oversell a product (final on-hand stock must never be negative, and the number of successful ships must exactly match the available supply).
- The `stock_movements` table is an immutable ledger: rows may only be INSERTed. Never UPDATE or DELETE existing ledger rows, and never mutate seeded rows.

## Implementation Hints
- Use `routeLoader$` for the server-side read (computed quantities) and `routeAction$` + `zod$` for the mutation; drive the mutation from a Qwik City `<Form>` so it works as a normal HTML form POST.
- Form fields arrive as strings — validate/convert them accordingly.
- Use `better-sqlite3` and wrap the check-and-insert of each adjustment in a single SQL transaction so the negative-stock guard and the ledger insert commit or roll back together.
- Keep all database imports and code inside server-only boundaries (`routeLoader$` / `routeAction$`) so no database module leaks into the client bundle.
- Project path: /home/user/inventory-app
- Start command: `npm run dev` (run inside the project directory)
- Port: 5173
- Database file (already created and seeded, do NOT recreate or reseed it): `/home/user/inventory-app/data/inventory.db`
- Existing schema:
  - `products(id INTEGER PRIMARY KEY, sku TEXT NOT NULL UNIQUE, name TEXT NOT NULL)`
  - `stock_movements(id INTEGER PRIMARY KEY AUTOINCREMENT, product_id INTEGER NOT NULL REFERENCES products(id), delta INTEGER NOT NULL, reason TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')))`
  - A positive `delta` is a receive; a negative `delta` is a ship. Current on-hand quantity of a product = SUM(delta) over its `stock_movements` rows.
- Rendered HTML contract for `/` (the tests parse these):
  - For every product render an element with attribute `data-testid="product-<id>"` that contains the product's SKU text.
  - Inside/for each product render an element with attribute `data-testid="qty-<id>"` whose text content is exactly the current integer on-hand quantity (e.g. `100`).
  - Render the movement `<Form>` (bound to your `routeAction$`) with attribute `data-testid="movement-form"`, containing inputs named `productId`, `type`, and `quantity`.
  - When a submission is rejected, the re-rendered page MUST contain an element with attribute `data-testid="error"` describing the failure.

