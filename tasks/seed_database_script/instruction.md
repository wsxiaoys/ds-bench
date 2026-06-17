# Seed Database Script

## Background
Prisma supports seeding a database via a script defined in `package.json` under `prisma.seed`. Running `npx prisma db seed` executes this script to pre-populate the database with initial data.

## Requirements
The project at `/home/user/myproject` has a migrated SQLite database with a `User` model. Create a seed script that inserts three users, then run the seed.

## Implementation Guide
1. Create `/home/user/myproject/prisma/seed.js` that:
   - Imports `PrismaClient` from `@prisma/client`
   - Creates a Prisma client instance
   - Uses `prisma.user.createMany` (or three `prisma.user.create` calls) to insert:
     - `{ email: 'alice@example.com', name: 'Alice' }`
     - `{ email: 'bob@example.com', name: 'Bob' }`
     - `{ email: 'carol@example.com', name: 'Carol' }`
   - Calls `prisma.$disconnect()` in a `finally` block
2. Add the seed configuration to `package.json`:
   ```json
   "prisma": { "seed": "node prisma/seed.js" }
   ```
3. Run the seed: `npx prisma db seed`

## Constraints
- Project path: `/home/user/myproject`
- Seed script path: `/home/user/myproject/prisma/seed.js`
- Use CommonJS (`require`) in the seed script
- The database already exists with the User table migrated
