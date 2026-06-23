# Many To Many Implicit Relation

## Background
Prisma supports implicit many-to-many relations using a simple array field on each model without defining an explicit join table. Prisma automatically creates the join table in the migration.

## Requirements
Add a `Tag` model to the schema with an implicit many-to-many relation to `Post`, migrate, then write a script that creates posts with tags and queries back posts with their tags.

## Implementation Guide
1. The project already has `User` and `Post` models. Open `prisma/schema.prisma` and:
   - Add a `Tag` model: `id Int @id @default(autoincrement())`, `name String @unique`, `posts Post[]`
   - Add `tags Tag[]` to the existing `Post` model
2. Run: `npx prisma migrate dev --name add_tags`
3. Create `/home/user/myproject/m2m.js`:
   - Create two tags: `{ name: 'nodejs' }` and `{ name: 'prisma' }`
   - Create a post connected to both tags using `connect`: `prisma.post.create({ data: { title: 'Prisma Node', authorId: 1, tags: { connect: [{ name: 'nodejs' }, { name: 'prisma' }] } } })`
     - First create a user: `{ email: 'm2m@example.com', name: 'M2M User' }`
   - Query the post with `include: { tags: true }`
   - Write result to `/home/user/myproject/m2m_result.json`
4. Run: `node m2m.js`

## Constraints
- Project path: `/home/user/myproject`
- Output file: `/home/user/myproject/m2m_result.json`
