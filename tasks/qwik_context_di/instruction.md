# Qwik Context Dependency Injection Across a Deep Component Tree

## Background
You are building a small storefront page with **Qwik** (`@builder.io/qwik` and `@builder.io/qwik-city`, version `1.20.0`). The page shows a shopping cart whose reactive state and UI theme are shared across a deeply nested component tree. Instead of drilling props, the shared state must be injected with Qwik's context API and consumed by components several levels deep. The page must be server-side rendered and must resume on the client so that user interactions work.

## Requirements
- Build a Qwik City application whose home route (`/`) renders a component tree with the behaviour described below.
- Provide **two distinct contexts** created with `createContextId` and made available with `useContextProvider` **once, at the root route layout** (`src/routes/layout.tsx`):
  - A **theme context** carrying a reactive theme value that is either `light` or `dark` (initial value `light`).
  - A **cart context** carrying a reactive store of cart items. Each item is an object with the keys `id` (string), `name` (string), `price` (number), and `quantity` (number). The store is initially seeded with exactly these two items, in this order:
    - `{ "id": "sku-1", "name": "Keyboard", "price": 49.99, "quantity": 1 }`
    - `{ "id": "sku-2", "name": "Mouse", "price": 19.99, "quantity": 2 }`
- Both contexts must be consumed **only** through `useContext` inside components that are nested **at least three component levels below** the provider. Passing the theme value or the cart store down through component props is not allowed.
- A single `useComputed$` must derive the cart aggregates (total item count and total price) from the injected cart store. The aggregates must stay correct after every mutation.
- Mutations to the cart must be performed by deeply nested child components through the injected cart store (not by lifting handlers to the provider and passing them down as props). Qwik's fine-grained reactivity must update only the DOM nodes bound to the changed state.
- The application must be **server-side rendered**: the initial HTML returned by the server (before any client JavaScript runs) must already contain the fully rendered deep tree with the context-derived values. The serialized state must allow the client to **resume** so that all interactions below work without a full page reload.

## Implementation Hints
- Project path: `/home/user/qwik-context-di`
- Start command: `npm run serve` (after `npm run build`). The server must perform per-request server-side rendering and listen on port `3000`, bound so it is reachable from outside the container.
- Port: `3000`
- The home route `/` must expose the following DOM contract. All listed `data-testid` values are required and each element's visible text must match exactly as specified.
  - The outermost application container element must have `data-testid="app-root"` and a `data-theme` attribute whose value equals the current theme (`light` or `dark`).
  - An element with `data-testid="theme-label"` whose text is exactly `Theme: <theme>` (e.g. `Theme: light`).
  - A `<button>` with `data-testid="theme-toggle"` that toggles the theme between `light` and `dark` on each click. Every theme consumer (including `app-root`'s `data-theme` and `theme-label`) must reflect the change.
  - An element with `data-testid="cart-count"` whose text is exactly the total item count (sum of every item's `quantity`), rendered as a plain integer (e.g. `3`).
  - An element with `data-testid="cart-total"` whose text is exactly the total price (sum of `price * quantity` over all items), formatted as a dollar sign followed by the amount fixed to two decimals (e.g. `$89.97`).
  - For every cart item there must be a row element with `data-testid="item-<id>"` (e.g. `item-sku-1`) containing:
    - the item's `name` as visible text,
    - an element with `data-testid="qty-<id>"` whose text is exactly that item's `quantity` as a plain integer,
    - a `<button>` with `data-testid="inc-<id>"` that increases that item's `quantity` by 1 per click,
    - a `<button>` with `data-testid="dec-<id>"` that decreases that item's `quantity` by 1 per click but never below `0`.
  - A `<button>` with `data-testid="add-item"` that appends a new item `{ "id": "sku-3", "name": "Cable", "price": 9.99, "quantity": 1 }` to the cart store. Clicking it once must render a new `item-sku-3` row and update the aggregates. If `sku-3` already exists, clicking must not add a duplicate row.
- `cart-count` and `cart-total` must always stay consistent with the current item quantities after any of the interactions above.

