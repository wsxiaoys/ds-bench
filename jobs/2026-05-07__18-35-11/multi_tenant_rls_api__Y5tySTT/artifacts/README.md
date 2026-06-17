# Multi-Tenant RLS API — Artifacts

## Files

### `code/server.js`
Express REST API (port 3000) with:
- `GET /items` — returns items scoped to the tenant in the `x-tenant-id` header
- `POST /items` — creates an item owned by the tenant in the `x-tenant-id` header (body: `{ name }`)

Tenant isolation is enforced using a **Prisma Client Extension** (`$extends`) created per-request.
The extension intercepts all `item.*` operations and injects the `tenantId` into every `where`/`data` clause automatically.

### `code/schema.prisma`
Prisma schema with the `Item` model:
```prisma
model Item {
  id       String @id @default(cuid())
  name     String
  tenantId String

  @@index([tenantId])
}
```

## Start Command
```
node server.js
```

## Test Curl Commands
```bash
# Create items for different tenants
curl -X POST http://localhost:3000/items \
  -H "x-tenant-id: tenant-a" \
  -H "Content-Type: application/json" \
  -d '{"name": "Widget Alpha"}'

curl -X POST http://localhost:3000/items \
  -H "x-tenant-id: tenant-b" \
  -H "Content-Type: application/json" \
  -d '{"name": "Widget Gamma"}'

# Read — each tenant only sees their own data
curl http://localhost:3000/items -H "x-tenant-id: tenant-a"
curl http://localhost:3000/items -H "x-tenant-id: tenant-b"
```

## Design Notes
- A single `basePrisma` client is created at startup (shared DB connection).
- Per request, `createScopedClient(tenantId)` calls `basePrisma.$extends({...})` to produce a lightweight scoped client.
- The extension uses Prisma's **query-level middleware** to inject `tenantId` into `findMany`, `findFirst`, `findUnique`, `create`, `createMany`, `update`, `updateMany`, `delete`, and `deleteMany` — ensuring no cross-tenant data leakage.
- The SQLite adapter used is `@prisma/adapter-better-sqlite3` (required by Prisma v7's client engine architecture).
