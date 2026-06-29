# Convex Bank Transfer Transaction

## Background
Convex mutations provide deterministic, transactional guarantees. In this task, you will implement a bank transfer mutation that ensures atomicity across multiple table updates, handling edge cases like insufficient funds.

## Requirements
- Initialize a Convex project in `/home/user/myproject`.
- Define a schema with an `accounts` table containing `name` (string) and `balance` (number).
- Create a mutation `createAccount` in `convex/accounts.ts` that takes `{ name: string, initialBalance: number }` and creates an account.
- Create a mutation `transfer` in `convex/accounts.ts` that takes `{ fromName: string, toName: string, amount: number }`.
- The `transfer` mutation must atomically deduct `amount` from the `fromName` account and add it to the `toName` account.
- The `transfer` mutation must throw an error if the `fromName` account has insufficient balance.
- The `transfer` mutation must throw an error if the `amount` is negative or zero.
- Create a query `getBalance` in `convex/accounts.ts` that takes `{ name: string }` and returns the account's balance as a number.
- Deploy the Convex functions using `npx convex deploy` and redirect the command output to the log file `/home/user/myproject/deploy.log`.

## Implementation Hints
- Use `ctx.db.query` with an index or filter to find accounts by `name`.
- Use `ctx.db.patch` to update the balances.
- Remember that mutations in Convex are automatically transactional; if you throw an error, all database changes in that mutation are rolled back.
- You will need to configure the project and deploy it using `npx convex deploy` using the provided `CONVEX_DEPLOY_KEY`.
- Note: During testing, account names will be suffixed with the `run-id` read from `/logs/artifacts/run-id` to avoid collisions.

