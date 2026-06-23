# Multi-Tenant RLS API

A multi-tenant REST API where each tenant's data is isolated using a `tenantId` header, enforced by a Prisma Client Extension.

## Features

- **Tenant Isolation**: Each tenant's data is automatically isolated using Prisma Client Extensions
- **SQLite Database**: Uses SQLite with better-sqlite3 adapter for data persistence
- **Express Server**: Built with Express.js on port 3000
- **Automatic Tenant Filtering**: All queries automatically filter by tenant ID
- **Automatic Tenant Assignment**: All creates automatically assign tenant ID

## Setup

```bash
# Install dependencies
npm install

# Generate Prisma client
npx prisma generate

# Push database schema
npx prisma db push

# Start the server
node server.js
```

## API Endpoints

### GET /items
Returns only items belonging to the tenant in the `x-tenant-id` header.

**Headers:**
- `x-tenant-id` (required): The tenant ID for which to fetch items

**Example:**
```bash
curl http://localhost:3000/items -H "x-tenant-id: tenant1"
```

**Response:**
```json
[
  {
    "id": "uuid",
    "name": "Item name",
    "tenantId": "tenant1"
  }
]
```

### POST /items
Creates an item for the tenant in the `x-tenant-id` header.

**Headers:**
- `x-tenant-id` (required): The tenant ID for which to create the item
- `Content-Type`: application/json

**Body:**
```json
{
  "name": "Item name"
}
```

**Example:**
```bash
curl -X POST http://localhost:3000/items \
  -H "x-tenant-id: tenant1" \
  -H "Content-Type: application/json" \
  -d '{"name": "My Item"}'
```

**Response:**
```json
{
  "id": "uuid",
  "name": "My Item",
  "tenantId": "tenant1"
}
```

## How Tenant Isolation Works

The tenant isolation is implemented using Prisma Client Extensions. The `createScopedClient` function creates a new Prisma client instance per request that automatically:

1. **Filters all queries** by adding `tenantId` to the `where` clause
2. **Sets tenantId on create** operations automatically
3. **Prevents tenant modification** on update operations
4. **Enforces tenant isolation** on delete operations

This ensures that each tenant can only access and modify their own data, providing row-level security (RLS) at the application level.

## Database Schema

```prisma
model Item {
  id       String @id @default(uuid())
  name     String
  tenantId String
}
```

## Error Handling

- Missing `x-tenant-id` header returns 400 status with error message
- Missing `name` in request body returns 400 status with error message
- Server errors return 500 status with error message

## Testing

The API has been tested with multiple tenants to verify proper isolation:

```bash
# Create items for tenant1
curl -X POST http://localhost:3000/items -H "x-tenant-id: tenant1" -H "Content-Type: application/json" -d '{"name": "Item 1"}'

# Create items for tenant2
curl -X POST http://localhost:3000/items -H "x-tenant-id: tenant2" -H "Content-Type: application/json" -d '{"name": "Item 2"}'

# Verify tenant1 only sees its items
curl http://localhost:3000/items -H "x-tenant-id: tenant1"

# Verify tenant2 only sees its items
curl http://localhost:3000/items -H "x-tenant-id: tenant2"
```

## Dependencies

- `@prisma/client`: Prisma Client for database operations
- `@prisma/adapter-better-sqlite3`: SQLite adapter for Prisma 7
- `better-sqlite3`: Fast SQLite3 driver for Node.js
- `express`: Web framework for API server
- `prisma`: Prisma CLI for database management