# Refactor Sequelize Sync to Migrations

## Background
In development, developers often use `sequelize.sync({ force: true })` to quickly apply model changes to the database. However, this is highly dangerous in production as it drops and recreates tables, leading to data loss. The best practice is to use `sequelize-cli` to manage database schema changes via migrations.

You have an existing Express application that uses Sequelize with SQLite. The application currently calls `sequelize.sync({ force: true })` on startup to create the `Users` table.

## Requirements
- Refactor the application to stop using `sequelize.sync({ force: true })` or `sequelize.sync()` in `index.js`.
- Initialize `sequelize-cli` and create an initial migration that creates the `Users` table matching the existing `User` model (with `id`, `username`, `createdAt`, and `updatedAt`).
- Apply the migration to the SQLite database so the table is created properly.
- Ensure the Express application still functions correctly and data is persisted across restarts.

## Implementation Hints
- Use `npx sequelize-cli init` to set up the migration folders.
- Generate a new migration file using `npx sequelize-cli migration:generate` and write the `up` and `down` methods to create and drop the `Users` table.
- Run the migration using `npx sequelize-cli db:migrate`.
- Remove the `sequelize.sync()` call from `index.js`.

## Acceptance Criteria
- Project path: /home/user/project
- Start command: node index.js
- Port: 3000
- The application must not use `sync()` to create tables.
- The database must contain the `SequelizeMeta` table, indicating that migrations are being used.
- API Endpoints:
  - GET `/users`: Returns status 200 and a JSON array of user objects.
  - POST `/users`: Accepts JSON `{"username": "string"}` and returns 201 Created with the new user object.

