# Basic Crud User Post

## Background
Prisma Client provides a type-safe API for CRUD operations. This task exercises the four fundamental operations — create, read, update, delete — on the `User` model.

## Requirements
Write a Node.js script that performs a complete CRUD cycle on the `User` table and writes a JSON result file.

## Implementation Guide
1. Create `/home/user/myproject/crud.js` using `require('@prisma/client')`.
2. The script must (in order):
   a. **Create** a user: `{ email: 'test@example.com', name: 'Test User' }`
   b. **Read** it back with `prisma.user.findUnique({ where: { email: 'test@example.com' } })`
   c. **Update** the name to `'Updated User'` using `prisma.user.update`
   d. **Delete** the user using `prisma.user.delete`
   e. **Confirm deletion** by calling `findUnique` again and asserting the result is `null`
3. Write the final status to `/home/user/myproject/crud_result.json` as `{ "status": "ok", "deleted": true }`
4. Run the script: `node crud.js`

## Constraints
- Project path: `/home/user/myproject`
- Output file: `/home/user/myproject/crud_result.json`
- Use CommonJS (`require`) in the script
