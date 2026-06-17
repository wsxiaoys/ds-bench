# One To Many Relation

## Background
A one-to-many relation in Prisma links a parent model to multiple children via a foreign key. This task requires extending the schema with a `Post` model, migrating, and querying users with their posts using `include`.

## Requirements
Add a `Post` model related to `User`, migrate, create a user with posts, then query the user with their posts included.

## Implementation Guide
1. Open `prisma/schema.prisma` and add:
   - A `Post` model: `id Int @id @default(autoincrement())`, `title String`, `authorId Int`, `author User @relation(fields: [authorId], references: [id])`
   - Add `posts Post[]` back-relation to the `User` model
2. Run: `npx prisma migrate dev --name add_post`
3. Create `/home/user/myproject/relation.js`:
   - Create a user `{ email: 'author@example.com', name: 'Author' }` with two posts nested using `create: { posts: { create: [{ title: 'Post One' }, { title: 'Post Two' }] } }`
   - Query the user with `include: { posts: true }`
   - Write the result to `/home/user/myproject/relation_result.json`
4. Run: `node relation.js`

## Constraints
- Project path: `/home/user/myproject`
- Output file: `/home/user/myproject/relation_result.json`
