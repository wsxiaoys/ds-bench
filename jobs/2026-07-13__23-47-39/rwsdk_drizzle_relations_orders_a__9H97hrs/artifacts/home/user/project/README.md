# RedwoodSDK Minimal Starter

This is the starter project for RedwoodSDK. It's a template designed to get you up and running as quickly as possible.

Create your new project:

```shell
npx create-rwsdk my-project-name
cd my-project-name
npm install
```

## Running the dev server

```shell
npm run dev
```

Point your browser to the URL displayed in the terminal (e.g. `http://localhost:5173/`). You should see the RedwoodSDK welcome page in your browser.

## Database (Cloudflare D1 + Drizzle ORM)

This project persists data in a Cloudflare D1 (SQLite) database accessed through
[Drizzle ORM](https://orm.drizzle.team). The `DB` binding is declared in
`wrangler.jsonc` and the Drizzle schema lives in `src/db/schema.ts`.

### Setup

Generate a migration from the schema and apply it to the local database, then
seed some sample data:

```shell
npm run db:generate   # drizzle-kit generate
npm run db:migrate    # wrangler d1 migrations apply DB --local
npm run db:seed       # wrangler d1 execute DB --local --file=drizzle/seed.sql
```

> Local D1 runs through Wrangler/Miniflare and does not require real
> Cloudflare credentials. The local database state is stored under `.wrangler/`.

### API

- `GET /api/orders/:id` — returns a single order together with its nested line
  items as JSON, loaded via Drizzle's relational query API.

  **200 OK**
  ```json
  {
    "id": 1,
    "customerName": "Alice Anderson",
    "status": "pending",
    "items": [
      { "id": 1, "productName": "Widget", "quantity": 2, "unitPrice": 1500 },
      { "id": 2, "productName": "Gadget", "quantity": 1, "unitPrice": 2500 }
    ]
  }
  ```

  **404 Not Found** (no order for the given `id`)
  ```json
  { "error": "Order 999 not found" }
  ```

## Further Reading

- [RedwoodSDK Documentation](https://docs.rwsdk.com/)
- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers)
- [Drizzle ORM Documentation](https://orm.drizzle.team)
- [Cloudflare D1 Documentation](https://developers.cloudflare.com/d1)
