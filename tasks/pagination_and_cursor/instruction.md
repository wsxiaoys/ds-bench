# Pagination And Cursor

## Background
Prisma supports two pagination strategies: offset-based (`skip`/`take`) and cursor-based (`cursor`/`take`). Cursor pagination is more efficient for large datasets.

## Requirements
The database has 20 pre-seeded users (id 1–20). Write a script that demonstrates cursor-based pagination: fetch the first page of 5, then use the last cursor to fetch the next 5.

## Implementation Guide
1. Create `/home/user/myproject/paginate.js`:
   - Import `PrismaClient`
   - **Page 1**: `prisma.user.findMany({ take: 5, orderBy: { id: 'asc' } })`
   - **Page 2**: `prisma.user.findMany({ take: 5, skip: 1, cursor: { id: page1[page1.length - 1].id }, orderBy: { id: 'asc' } })`
   - Write result to `/home/user/myproject/paginate_result.json`:
     ```json
     { "page1": [...], "page2": [...] }
     ```
2. Run: `node paginate.js`

## Constraints
- Project path: `/home/user/myproject`
- Output file: `/home/user/myproject/paginate_result.json`
- Users are pre-seeded with ids 1–20 and emails `user1@example.com` through `user20@example.com`
