# Generate Client After Schema Change

## Background
Prisma generates a type-safe client from `schema.prisma`. Whenever you change the schema (add a model, field, or relation), you must regenerate the client so the new types are available at runtime.

## Requirements
The project at `/home/user/myproject` already has a `User` model. Add a `Post` model linked to `User`, then regenerate the Prisma Client without running a migration.

## Implementation Guide
1. Open `prisma/schema.prisma` in `/home/user/myproject`.
2. Add a `Post` model with:
   - `id`: Int, primary key, auto-incremented
   - `title`: String
   - `content`: String, optional
   - `authorId`: Int (foreign key to User)
   - `author`: relation to `User` using `@relation(fields: [authorId], references: [id])`
3. Also add a `posts Post[]` back-relation field to the existing `User` model.
4. Run ONLY `npx prisma generate` — do NOT run `prisma migrate`.

## Constraints
- Project path: `/home/user/myproject`
- Use SQLite datasource (already configured)
- Run `npx prisma generate` only — no migration
- Do not modify the datasource or generator blocks
