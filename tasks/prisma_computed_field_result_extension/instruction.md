# Computed Field Result Extension

## Background
Prisma Client Extensions support a `result` component that lets you add virtual (computed) fields to model results at query time, without storing them in the database.

## Requirements
Add a computed `fullLabel` field to the `User` model that concatenates `name` and `email` in brackets.

## Implementation Guide
1. Create `/home/user/myproject/computed.js`:
   - Import `PrismaClient`
   - Create an extended client:
     ```js
     const xprisma = new PrismaClient().$extends({
       result: {
         user: {
           fullLabel: {
             needs: { name: true, email: true },
             compute(user) {
               return `${user.name} <${user.email}>`;
             }
           }
         }
       }
     });
     ```
   - Create a user `{ email: 'computed@example.com', name: 'Computed' }`
   - Query it with `xprisma.user.findUnique({ where: { email: 'computed@example.com' } })`
   - Write the result (including the computed field) to `/home/user/myproject/computed_result.json`
2. Run: `node computed.js`

## Constraints
- Project path: `/home/user/myproject`
- Output file: `/home/user/myproject/computed_result.json`
