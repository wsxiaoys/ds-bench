# Raw Sql Query Execution

## Background
Prisma provides `$queryRaw` and `$executeRaw` for running raw SQL when the query builder is insufficient. This is useful for database-specific features, complex joins, or DDL operations.

## Requirements
Write a script that uses raw SQL to query and update data.

## Implementation Guide
1. The DB has a `User` table with 3 seeded users.
2. Create `/home/user/myproject/rawsql.js`:
   - Import `PrismaClient` and `Prisma` namespace
   - Use `prisma.$queryRaw` with a tagged template literal to count users:
     ```js
     const count = await prisma.$queryRaw`SELECT COUNT(*) as cnt FROM User`;
     ```
   - Use `prisma.$executeRaw` to update all users' names to uppercase:
     ```js
     await prisma.$executeRaw`UPDATE User SET name = UPPER(name)`;
     ```
   - Query all users after the update with `prisma.user.findMany()`
   - Write to `/home/user/myproject/rawsql_result.json`:
     ```json
     { "countResult": [...], "users": [...] }
     ```
3. Run: `node rawsql.js`

## Constraints
- Project path: `/home/user/myproject`
- Output file: `/home/user/myproject/rawsql_result.json`
- DB has 3 users: `{ name: 'Alice' }`, `{ name: 'Bob' }`, `{ name: 'Carol' }`
