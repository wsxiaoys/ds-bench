# Migration History Squash

The project at `/home/user/myproject` has accumulated 5 separate Prisma migrations over time. Squash (consolidate) them into a single baseline migration without losing data.

Project path: `/home/user/myproject`

## Implementation Hints
- The new baseline migration directory must be named exactly `0001_baseline` (under `prisma/migrations/`) and contain the `migration.sql` file.
- Delete the old migration directories so only the baseline remains.
- Write the final output of `npx prisma migrate status` to `/home/user/myproject/squash_result.txt`.
