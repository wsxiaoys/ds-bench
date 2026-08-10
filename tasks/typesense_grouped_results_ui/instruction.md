# Grouped Search Results Storefront (Typesense v26.0)

## Background
You are building the results page for a small product storefront. Search is powered by a local **Typesense v26.0** server available at `127.0.0.1:8108`. Instead of a flat list, the UI must present hits **grouped by brand**: each brand is its own collapsible section that shows how many products in total matched inside that brand, while only a few items per brand are shown up front. Shoppers can expand an individual brand to see the rest, and can page through brands.

The Typesense server is reachable using these environment variables: `TYPESENSE_HOST` (`127.0.0.1`), `TYPESENSE_PORT` (`8108`), `TYPESENSE_PROTOCOL` (`http`), and `the file `/etc/typesense-api-key``. The server starts empty, so your application is responsible for creating its collection and loading the dataset on startup (before it serves results).

## Requirements
- On startup, load the provided dataset at `data/products.jsonl` (20 products) into a Typesense collection named `products`. Each product has the keys `id`, `name`, `brand`, `popularity` (integer) and `price` (float). Loading must be idempotent (safe to start more than once against the same server).
- Serve a web page that runs a search and renders the matching products **grouped by the `brand` field**.
- Each rendered brand group must display the brand value and the **total number of products that matched inside that brand** (this total must be correct even when only some of the brand's items are shown).
- Initially each brand group shows **at most 3 items** (the per-group limit). A brand that matched **more than 3** products must offer a "Show more" control that, when activated, reveals the remaining items of *that* brand only. A brand that matched **3 or fewer** products must NOT render a "Show more" control.
- Both the ordering of brand groups and the ordering of items within each group must be by `popularity` in **descending** order (highest first).
- The list of brand groups is **paginated at the group level**, showing **at most 3 brand groups per page**, with controls to move to the next and previous page.
- An empty query must match all products.

## Implementation Hints
- Project path: /home/user/app
- Start command: `npm start`
- Port: 3000 (listen on `0.0.0.0`)
- Typesense version: 26.0. Connect using the `TYPESENSE_HOST`, `TYPESENSE_PORT`, `TYPESENSE_PROTOCOL` and `the file `/etc/typesense-api-key`` environment variables.
- Dataset file (provided, do not modify): `/home/user/app/data/products.jsonl`. The searchable text lives in the `name` field.
- Per-group item limit: 3. Brand groups per page: 3.
- Routes / navigable state (the page must render the correct grouped state for these):
  - `GET /` — the results page. It must accept an optional query-string query term `q` and an optional 1-based `page` number, e.g. `GET /?q=audio&page=2`. When `q` is absent or empty, all products match.
- The results page must expose the following stable DOM contract so the state can be inspected programmatically:
  - The search text input carries `data-testid="search-input"`.
  - Each brand group is an element with `data-testid="group"`, and carries `data-brand="<brand value>"` and `data-total="<total matching products in this brand>"`. The brand value and its total must also be shown as human-readable text inside the group.
  - Groups appear in the DOM in their sorted order; within the current page there must be no more than 3 group elements.
  - Each shown product is an element with `data-testid="item"` nested inside its brand group, carrying `data-id="<product id>"`. Only currently-shown items may be present/visible; items must appear in their sorted order.
  - The "Show more" control of a group (present only when the group's total exceeds 3) carries `data-testid="show-more"`. Activating it must cause that group to show all of its items (the number of visible `data-testid="item"` elements in that group becomes equal to its `data-total`).
  - Group-level pagination controls carry `data-testid="next-page"` and `data-testid="prev-page"`, and a current page indicator carries `data-testid="page-indicator"` whose text contains the current 1-based page number.

