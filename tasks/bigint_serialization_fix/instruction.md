# Bigint Serialization Fix

## Background
When using `$queryRaw`, Prisma returns `BigInt` values for SQL aggregate functions (like `COUNT(*)`) in SQLite. JavaScript's `JSON.stringify` cannot serialize `BigInt` natively and throws `TypeError: Do not know how to serialize a BigInt`. You must handle this by converting `BigInt` to a `Number` or `String` before serialization.

## Requirements
The project has a script `rawcount.js` that calls `prisma.$queryRaw` to count users and tries to `JSON.stringify` the result — but it crashes with a BigInt serialization error. Fix the script so it serializes correctly and writes the result to a file.

## Implementation Guide
1. Open `/home/user/myproject/rawcount.js` — it already exists and is broken.
2. The script currently does:
   ```js
   const result = await prisma.$queryRaw`SELECT COUNT(*) as cnt FROM User`;
   fs.writeFileSync('rawcount_result.json', JSON.stringify(result));
   ```
3. Fix the BigInt serialization by converting `BigInt` values to `Number` before writing:
   - Option A: `JSON.stringify(result, (key, value) => typeof value === 'bigint' ? Number(value) : value)`
   - Option B: Use `Prisma.Decimal` utilities or manually map the result
4. The fixed script must write `/home/user/myproject/rawcount_result.json` containing `[{"cnt": 3}]`
5. Run: `node rawcount.js`

## Constraints
- Project path: `/home/user/myproject`
- Fix the existing `rawcount.js` — do NOT replace it entirely
- Output file: `/home/user/myproject/rawcount_result.json`
- DB has 3 users
