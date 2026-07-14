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

## Database

The project is wired up with [Drizzle ORM](https://orm.drizzle.team/) on top of a Cloudflare D1 binding named `DB`.

- Schema lives at `src/db/schema.ts`.
- The Drizzle client is created in `src/db/client.ts` and bound to the `DB` D1 binding.
- Migrations are stored in `drizzle/migrations/`.

Useful scripts:

```shell
npm run migrate:new   # Generate a new migration from the Drizzle schema
npm run migrate:dev   # Apply migrations to the local D1 database
npm run migrate:prod  # Apply migrations to the remote D1 database
```

## API

### `GET /api/users`

Lists users ordered by `id` ascending.

Query parameters (both optional):

- `limit` (default `10`) — maximum number of users to return.
- `offset` (default `0`) — number of users to skip.

Response:

```json
{
  "users": [{ "id": 1, "name": "Alice", "email": "alice@example.com" }],
  "total": 1,
  "limit": 10,
  "offset": 0
}
```

### `POST /api/users`

Creates a new user. Request body:

```json
{ "name": "Alice", "email": "alice@example.com" }
```

Responses:

- `201 Created` — the created user.
- `400 Bad Request` — `name` or `email` is missing or empty.
- `409 Conflict` — a user with the same `email` already exists.

## Further Reading

- [RedwoodSDK Documentation](https://docs.rwsdk.com/)
- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers)