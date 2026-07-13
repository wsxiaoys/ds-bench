# Relational Orders API with RedwoodSDK, Cloudflare D1 and Drizzle ORM

## Background
A scaffolded RedwoodSDK project is available at `/home/user/project`. RedwoodSDK is a server-first React framework for Cloudflare that runs as a Vite plugin and uses standard Web `Request`/`Response` objects for routing. You must extend this project with a persistence layer backed by Cloudflare D1 (SQLite) accessed through Drizzle ORM, and expose a read API that returns an order together with its nested line items.

## Requirements
- Configure a Cloudflare D1 database binding named `DB` for the worker and wire Drizzle ORM to it (local development mode is sufficient; no Cloudflare account is required).
- Define a relational Drizzle schema with two tables and a one-to-many relationship, and manage it with generated D1 migrations:
  - Table `orders` with columns: `id` (integer, primary key), `customer_name` (text, not null), `status` (text, not null).
  - Table `order_items` with columns: `id` (integer, primary key), `order_id` (integer, not null, foreign key referencing `orders.id`), `product_name` (text, not null), `quantity` (integer, not null), `unit_price` (integer, not null).
  - Declare the one-to-many relation (`orders` has many `order_items`) using Drizzle relations so it can be queried with Drizzle's relational query API (`db.query`).
- Implement a JSON API route `GET /api/orders/:id` that loads a single order and its associated line items using Drizzle's relational query API and returns them as nested JSON.

## API Contract
- `GET /api/orders/:id`
  - On success: respond with HTTP `200` and a JSON body (`Content-Type: application/json`) with this shape:
    ```json
    {
      "id": number,
      "customerName": string,
      "status": string,
      "items": [
        {
          "id": number,
          "productName": string,
          "quantity": number,
          "unitPrice": number
        }
      ]
    }
    ```
    The `items` array contains one entry per row in `order_items` whose `order_id` matches the requested order. Column values are mapped to the camelCase keys shown above.
  - When no order exists for the given `id`: respond with HTTP `404` and a JSON body of the shape `{ "error": string }`.

## Implementation Hints
- Add the D1 binding to `wrangler.jsonc` (binding `DB`, a `database_name`, a placeholder `database_id`, and a `migrations_dir`). Local D1 runs through Wrangler/Miniflare and does not need real Cloudflare credentials.
- Install `drizzle-orm` and `drizzle-kit`, add a `drizzle.config.ts` pointing at your schema with the `sqlite` dialect, and create the Drizzle client with `drizzle(env.DB, { schema })` from `drizzle-orm/d1` (import `env` from `cloudflare:workers`).
- Use Drizzle's relations helpers so the order and its items can be fetched in one relational query (for example `db.query.orders.findFirst({ where: ..., with: { items: true } })`) instead of manual joins.
- Generate a migration from your schema and apply it to the local database before running the app (the RedwoodSDK Drizzle guide suggests `drizzle-kit generate` plus `wrangler d1 migrations apply DB --local`).
- Register the route inside `defineApp` in the worker entry file. Dynamic segments such as `:id` are available on the handler's `params`.

## Project
- Project path: `/home/user/project`
- Start command: `npm run dev`
- Port: `5173`

