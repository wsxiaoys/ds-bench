# Cascading Soft Deletes with Sequelize Hooks

## Background
In Sequelize, the `paranoid` option allows for soft deletes (setting a `deletedAt` timestamp instead of physically removing the record). However, soft deletes do not automatically cascade to associated models. Build an Express API backed by Sequelize and SQLite where deleting a parent record also soft-deletes its children, and restoring the parent restores those children.

## Requirements
- The project must be located at `/home/user/myproject` and start using `node index.js` on port `3000`.
- Create an Express.js application with a SQLite database using Sequelize.
- Define two models: `User` and `Post`.
- A `User` has many `Post`s, and a `Post` belongs to a `User`.
- Both models must have `paranoid: true` enabled.
- Implement a cascading soft delete: When a `User` is soft-deleted, all their associated `Post`s must also be soft-deleted.
- Implement a cascading restore: When a `User` is restored, all their associated `Post`s must also be restored.
- Expose the following REST API endpoints:
  - **POST `/users`**: Accepts `{"username": string}` and returns `201 Created` with the created user object (must include `id`).
  - **POST `/users/:id/posts`**: Accepts `{"title": string}` and returns `201 Created` with the created post object (must include `id`).
  - **DELETE `/users/:id`**: Soft-deletes the user and their posts, returning `200 OK`.
  - **POST `/users/:id/restore`**: Restores the soft-deleted user and their posts, returning `200 OK`.
  - **GET `/posts/:id`**: Returns `200 OK` with the post object if it exists and is not soft-deleted. Returns `404 Not Found` if the post does not exist or is soft-deleted.

## Implementation Hints
- Use Sequelize model hooks (`afterDestroy` and `afterRestore`) on the `User` model to perform operations on the associated `Post` records.
- Ensure that when querying for posts to delete or restore, you handle the `paranoid` scope correctly so you can find soft-deleted posts when restoring.
- Use `sequelize.sync({ force: true })` during app startup to initialize the SQLite database schema.

