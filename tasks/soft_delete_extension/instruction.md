# Soft Delete Extension

## Background
Prisma Client Extensions allow you to add custom behavior, such as soft deletes, by wrapping model operations. Instead of deleting records, a `deletedAt` timestamp is set, and queries automatically exclude soft-deleted records.

## Requirements
Extend the Prisma Client to implement soft delete on the `User` model.

## Implementation Guide
1. The schema already has `User` with a `deletedAt DateTime?` field.
2. Create `/home/user/myproject/softdelete.js`:
   - Import `PrismaClient`
   - Create an extended client using `prisma.$extends({ model: { user: { ... } } })` that adds:
     - A custom `softDelete(where)` method that calls `prisma.user.update({ where, data: { deletedAt: new Date() } })`
     - Override `findMany` to exclude records where `deletedAt` is not null: add `where: { deletedAt: null }` by default
   - Create a user `{ email: 'soft@example.com', name: 'Soft' }`
   - Call `xprisma.user.softDelete({ email: 'soft@example.com' })`
   - Call `xprisma.user.findMany()` and assert it does NOT include the soft-deleted user
   - Write to `/home/user/myproject/softdelete_result.json`: `{ "visibleCount": <count>, "softDeletedExists": true/false }`
3. Run: `node softdelete.js`

## Constraints
- Project path: `/home/user/myproject`
- Output file: `/home/user/myproject/softdelete_result.json`
- Use `prisma.$extends` (Prisma Client Extensions API)
