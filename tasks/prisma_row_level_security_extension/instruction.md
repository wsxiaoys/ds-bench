# Row Level Security Extension

## Background
Prisma Client Extensions can implement row-level security (RLS) by automatically appending a tenant filter to all queries. This prevents data leakage between tenants without modifying every query manually.

## Requirements
Implement a tenant-scoped Prisma client using `$extends` that automatically filters `Note` records by `tenantId`.

## Implementation Guide
1. The schema has a `Note` model: `id Int @id @default(autoincrement())`, `content String`, `tenantId String`.
2. Create `/home/user/myproject/rls.js`:
   - Import `PrismaClient`
   - Create a factory function `createTenantClient(tenantId)` that returns:
     ```js
     new PrismaClient().$extends({
       query: {
         note: {
           async findMany({ args, query }) {
             args.where = { ...args.where, tenantId };
             return query(args);
           },
           async create({ args, query }) {
             args.data = { ...args.data, tenantId };
             return query(args);
           }
         }
       }
     })
     ```
   - Create tenant `'acme'` client and insert 2 notes
   - Create tenant `'globex'` client and insert 1 note
   - Query notes using each tenant client — each must only see its own notes
   - Write to `/home/user/myproject/rls_result.json`:
     `{ "acmeCount": 2, "globexCount": 1 }`
3. Run: `node rls.js`

## Constraints
- Project path: `/home/user/myproject`
- Output file: `/home/user/myproject/rls_result.json`
