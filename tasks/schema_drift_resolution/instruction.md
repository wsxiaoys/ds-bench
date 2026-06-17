# Schema Drift Resolution

## Background
Schema drift occurs when the actual database schema diverges from what Prisma expects — for example, when a column is added to the database directly via SQL without a corresponding Prisma migration. `prisma migrate diff` and `prisma db pull` can help detect and resolve drift.

## Requirements
The database has a `User` table with an extra column `bio TEXT` that was added directly via raw SQL, without a matching Prisma migration. Resolve the drift by updating the schema and creating a migration that brings Prisma in sync.

## Implementation Guide
1. Run `npx prisma db pull` to introspect the current database and update `schema.prisma` to reflect the actual `bio` column.
2. Verify that `schema.prisma` now includes `bio String?` on the `User` model.
3. Run `npx prisma migrate dev --name add_bio_drift_fix` to create a new migration that records this change (it may be a no-op migration since the column already exists in the DB — that is expected).
4. Run `npx prisma generate` to regenerate the client.
5. Write a quick verification script `/home/user/myproject/drift_check.js` that:
   - Creates a user with `bio: 'Hello world'`
   - Reads it back and writes to `/home/user/myproject/drift_result.json`
6. Run: `node drift_check.js`

## Constraints
- Project path: `/home/user/myproject`
- Output file: `/home/user/myproject/drift_result.json`
- Do NOT manually edit `schema.prisma` — use `prisma db pull`
