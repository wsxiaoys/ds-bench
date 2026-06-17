# Multi Tenant Rls Api

Build a multi-tenant REST API where each tenant's data is isolated using a `tenantId` header, enforced by a Prisma Client Extension.

Project at `/home/user/myproject`. Express and Prisma are pre-installed.

Schema:
- `Item`: id, name String, tenantId String

Build `server.js` on port 3000 with:
- `GET /items` — returns only items belonging to the tenant in the `x-tenant-id` header
- `POST /items` — creates an item for the tenant in the `x-tenant-id` header (body: `{ name }`)

Enforce tenantId using `prisma.$extends` inside request handlers (create a scoped client per request based on the header).

Start command: `node server.js`
Port: 3000
Project path: `/home/user/myproject`
