# Sequelize Hooks and Internal Transactions

## Background
Sequelize may use transactions internally for operations like `Model.findOrCreate`. If your hook functions execute read or write operations that need to be atomic with the main operation, you must ensure those operations participate in the same transaction.

## Requirements
- Create a Node.js module in `/home/user/myproject/index.js` that initializes a Sequelize SQLite database with two models: `User` and `AuditLog`.
- `User` model: `username` (STRING, unique), `status` (STRING).
- `AuditLog` model: `action` (STRING), `username` (STRING).
- Define a `beforeCreate` hook on the `User` model that creates an `AuditLog` entry with `action: 'Creating user'` and the user's `username`.
- Define an `afterCreate` hook on the `User` model that throws `new Error('Simulated failure')` if the `username` is exactly `'error_user'`.
- If the `User` creation fails (e.g., because the `afterCreate` hook throws), the corresponding `AuditLog` entry created by `beforeCreate` must also be rolled back so that no audit row remains for that username.
- Export an async function `initDB()` that syncs the database (e.g., `sequelize.sync({ force: true })`).
- Export an async function `runFindOrCreate(username)` that calls `User.findOrCreate({ where: { username }, defaults: { status: 'active' } })`. It should catch and return any errors thrown during the process, or return the created user.
- The module must export `initDB`, `runFindOrCreate`, `User`, and `AuditLog`.

## Implementation Hints
- When `findOrCreate` is executed, Sequelize creates an internal transaction.
- In your `beforeCreate` hook, check for `options.transaction` and pass it to the `AuditLog.create` method.
- If you don't pass the transaction, the `AuditLog` entry will be committed immediately, bypassing the rollback if the main transaction fails.

