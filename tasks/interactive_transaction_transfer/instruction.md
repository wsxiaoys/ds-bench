# Interactive Transaction Transfer

## Background
Prisma's interactive transactions (`prisma.$transaction(async (tx) => { ... })`) allow using the same transaction client across multiple operations with conditional logic. This is required for operations like bank transfers where you must check balances before debiting.

## Requirements
Write a script that performs a balance transfer between two accounts using an interactive transaction.

## Implementation Guide
1. The schema already has an `Account` model: `id Int @id @default(autoincrement())`, `owner String @unique`, `balance Float`.
2. Create `/home/user/myproject/transfer.js`:
   - Import `PrismaClient`
   - Use `prisma.$transaction(async (tx) => { ... })` to:
     1. Find the sender account (`owner: 'alice'`)
     2. If `sender.balance < 50`, throw an error
     3. Deduct 50 from sender: `tx.account.update({ where: { owner: 'alice' }, data: { balance: { decrement: 50 } } })`
     4. Add 50 to receiver: `tx.account.update({ where: { owner: 'bob' }, data: { balance: { increment: 50 } } })`
   - After the transaction, query both balances and write to `/home/user/myproject/transfer_result.json`:
     ```json
     { "alice": <balance>, "bob": <balance> }
     ```
3. Run: `node transfer.js`

## Constraints
- Project path: `/home/user/myproject`
- Output file: `/home/user/myproject/transfer_result.json`
- Alice starts with balance 100, Bob with balance 50
