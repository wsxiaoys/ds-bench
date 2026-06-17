# Nested Write Create Relation

## Background
Prisma supports nested writes — creating a parent and its children in a single `create` call. This avoids multiple round-trips and keeps the operation atomic.

## Requirements
Write a script that creates a `User` together with two `Post` records in a single nested `prisma.user.create` call.

## Implementation Guide
1. Create `/home/user/myproject/nested.js`:
   - Import `PrismaClient`
   - Call `prisma.user.create` with nested posts:
     ```js
     prisma.user.create({
       data: {
         email: 'nested@example.com',
         name: 'Nested Writer',
         posts: {
           create: [
             { title: 'Nested Post A' },
             { title: 'Nested Post B' }
           ]
         }
       },
       include: { posts: true }
     })
     ```
   - Write the result to `/home/user/myproject/nested_result.json`
2. Run: `node nested.js`

## Constraints
- Project path: `/home/user/myproject`
- Output file: `/home/user/myproject/nested_result.json`
- The schema already has `User` with `posts Post[]` and `Post` with `authorId`
