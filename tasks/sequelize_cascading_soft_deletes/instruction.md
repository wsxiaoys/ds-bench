# Cascading Soft Deletes with Sequelize Hooks

## Background
In Sequelize, the `paranoid` option allows for soft deletes (setting a `deletedAt` timestamp instead of physically removing the record). However, soft deletes do not automatically cascade to associated models. Build an Express API backed by Sequelize and SQLite where deleting a parent record also soft-deletes its children, and restoring the parent restores those children.

## Requirements
- Build an Express.js application backed by a Sequelize/SQLite database, located at `/home/user/myproject` and started with `node index.js` listening on port `3000`.
- Define two paranoid models, `User` and `Post`, with a one-to-many association (`User` has many `Post`s; `Post` belongs to a `User`).
- Soft-deleting a `User` must also soft-delete every `Post` that belongs to that user.
- Restoring a previously soft-deleted `User` must also restore every `Post` that was cascaded with it.
- Expose the following JSON REST endpoints:
  - `POST /users` — create a user from `{"username": string}`; respond with `201` and the user object (including its `id`).
  - `POST /users/:id/posts` — create a post for the given user from `{"title": string}`; respond with `201` and the post object (including its `id`).
  - `DELETE /users/:id` — soft-delete the user (and cascade to their posts); respond with `200`.
  - `POST /users/:id/restore` — restore the user (and cascade to their posts); respond with `200`.
  - `GET /posts/:id` — respond with `200` and the post object when the post exists and is not soft-deleted, or `404` otherwise.
