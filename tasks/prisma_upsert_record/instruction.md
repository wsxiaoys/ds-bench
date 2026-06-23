# Upsert Record

## Background
`prisma.user.upsert` either creates a record if it doesn't exist, or updates it if it does — determined by a unique field. This is useful for idempotent data ingestion.

## Requirements
Write a script that demonstrates upsert behaviour: run it twice with the same email but different names, and confirm the record is updated on the second run.

## Implementation Guide
1. Create `/home/user/myproject/upsert.js`:
   - Import `PrismaClient`
   - Call `prisma.user.upsert` with:
     - `where: { email: 'upsert@example.com' }`
     - `create: { email: 'upsert@example.com', name: 'First Run' }`
     - `update: { name: 'Second Run' }`
   - Run `upsert` **twice** (call it two times in sequence with `await`)
   - After the second upsert, call `prisma.user.findUnique({ where: { email: 'upsert@example.com' } })`
   - Write the resulting user object as JSON to `/home/user/myproject/upsert_result.json`
2. Run: `node upsert.js`

## Constraints
- Project path: `/home/user/myproject`
- Output file: `/home/user/myproject/upsert_result.json`
- Use CommonJS (`require`) in the script
