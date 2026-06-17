# Migration History Squash

The project at `/home/user/myproject` has accumulated 5 separate Prisma migrations over time. Squash (consolidate) them into a single baseline migration without losing data.

Project path: `/home/user/myproject`

Use `prisma migrate diff` and `prisma db execute` to create a clean baseline:
1. Run `npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script` to generate the full SQL for the current schema.
2. Delete all existing migration directories under `prisma/migrations/`.
3. Create a new directory `prisma/migrations/0001_baseline/` and save the SQL output as `migration.sql` inside it.
4. Create `prisma/migrations/migration_lock.toml` with the correct provider if missing.
5. Mark the baseline as applied: `npx prisma migrate resolve --applied 0001_baseline`
6. Run `npx prisma migrate status` to confirm no pending migrations.
7. Write the output of `npx prisma migrate status` to `/home/user/myproject/squash_result.txt`.

Project path: `/home/user/myproject`
Output file: `/home/user/myproject/squash_result.txt`
