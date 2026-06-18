# Filter And Sort Query

## Background
Prisma's `findMany` accepts `where` for filtering and `orderBy` for sorting. This task exercises both together to retrieve a meaningful subset of data.

## Requirements
The database is pre-seeded with 5 users. Write a script that queries users whose name starts with a specific letter, sorted by name ascending, and writes the results to a JSON file.

## Implementation Guide
1. Create `/home/user/myproject/query.js`:
   - Import `PrismaClient`
   - Call `prisma.user.findMany` with:
     - `where: { name: { startsWith: 'A' } }`
     - `orderBy: { name: 'asc' }`
   - Write the resulting array as JSON to `/home/user/myproject/query_result.json`
2. Run: `node query.js`

## Constraints
- Project path: `/home/user/myproject`
- Output file: `/home/user/myproject/query_result.json`
- Use CommonJS (`require`) in the script
- The database is pre-seeded with users: Alice, Aaron, Bob, Carol, Dave
