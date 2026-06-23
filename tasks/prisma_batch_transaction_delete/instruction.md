# Batch Transaction Delete

## Background
`prisma.deleteMany` removes multiple records matching a filter. Combined with `prisma.$transaction`, multiple operations can be grouped into an all-or-nothing batch.

## Requirements
The database has 10 users pre-seeded. Write a script that uses `prisma.$transaction` to: (1) delete all users whose email ends with `@old.com`, and (2) create one new user, atomically.

## Implementation Guide
1. Create `/home/user/myproject/batch.js`:
   - Import `PrismaClient`
   - Use `prisma.$transaction([...])` with two operations:
     1. `prisma.user.deleteMany({ where: { email: { endsWith: '@old.com' } } })`
     2. `prisma.user.create({ data: { email: 'new@example.com', name: 'New User' } })`
   - After the transaction, query total user count and write to `/home/user/myproject/batch_result.json` as `{ "remaining": <count>, "newUserExists": true/false }`
2. Run: `node batch.js`

## Constraints
- Project path: `/home/user/myproject`
- Output file: `/home/user/myproject/batch_result.json`
- The DB starts with 10 users: 5 with `@old.com` and 5 with `@keep.com`
