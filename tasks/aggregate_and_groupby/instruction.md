# Aggregate And Groupby

## Background
Prisma provides `aggregate` for computing statistics (count, sum, avg, min, max) and `groupBy` for grouping records by a field value.

## Requirements
The database has orders pre-seeded with different amounts and statuses. Write a script that uses `aggregate` and `groupBy` to compute order statistics.

## Implementation Guide
1. The schema already has an `Order` model: `id`, `amount Float`, `status String`.
2. Create `/home/user/myproject/aggregate.js`:
   - Import `PrismaClient`
   - **Aggregate**: `prisma.order.aggregate({ _count: true, _sum: { amount: true }, _avg: { amount: true } })`
   - **GroupBy**: `prisma.order.groupBy({ by: ['status'], _count: true, _sum: { amount: true } })`
   - Write result to `/home/user/myproject/aggregate_result.json`:
     ```json
     { "totals": { "count": ..., "sum": ..., "avg": ... }, "byStatus": [...] }
     ```
3. Run: `node aggregate.js`

## Constraints
- Project path: `/home/user/myproject`
- Output file: `/home/user/myproject/aggregate_result.json`
- DB has 6 orders: 3 with status `'pending'` (amounts 10, 20, 30) and 3 with status `'completed'` (amounts 100, 200, 300)
