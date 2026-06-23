# Prisma Seed Script

## Overview
This directory contains the artifacts from creating and running a Prisma seed script for the myproject database.

## Files

### seed.js
The main seed script that creates three users in the database:
- Alice (alice@example.com)
- Bob (bob@example.com)
- Carol (carol@example.com)

### package.json
Updated package.json with the `prisma.seed` configuration:
```json
"prisma": {
  "seed": "node prisma/seed.js"
}
```

## Implementation Details

### Seed Script Features
- Uses CommonJS (`require`) syntax as required
- Creates a PrismaClient instance
- Uses `prisma.user.createMany()` to insert three users
- Includes proper error handling
- Ensures database connection is closed in a `finally` block using `prisma.$disconnect()`

### Database Schema
The User model has the following fields:
- `id`: Int (auto-increment, primary key)
- `email`: String (unique)
- `name`: String (optional)

## Verification
The seed was successfully executed and verified. The database now contains:
- User #1: Alice (alice@example.com)
- User #2: Bob (bob@example.com)
- User #3: Carol (carol@example.com)

## Execution Command
```bash
npx prisma db seed
```

## Notes
- The project uses Prisma 6.19.3 with SQLite
- The database file is located at `prisma/dev.db`
- The seed script is idempotent - running it multiple times will fail if users already exist (due to unique email constraint)