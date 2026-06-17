# Sequelize Hooks for Slug Generation

## Background
Create an Express REST API with Sequelize and SQLite that automatically generates slugs for articles using Sequelize lifecycle hooks. This task evaluates your ability to properly configure model hooks for both single and bulk operations.

## Requirements
- Create an Express.js application with a Sequelize `Article` model.
- The `Article` model should have `title` (string) and `slug` (string) fields.
- Implement a Sequelize hook (e.g., `beforeCreate`, `beforeValidate`) to automatically generate a slug from the title (lowercase, spaces replaced with hyphens).
- Expose an endpoint to create a single article.
- Expose an endpoint to create multiple articles in bulk. Ensure that the slug generation hook logic also applies to bulk creations.

## Implementation Hints
- Define the `Article` model and add a hook that transforms the `title` into a `slug`.
- Remember that by default, individual model hooks (like `beforeCreate`) do not fire during `bulkCreate` operations for performance reasons. You must configure the bulk operation to trigger individual hooks, or implement a `beforeBulkCreate` hook to handle the array of instances.
- Use SQLite as the database dialect.

## Acceptance Criteria
- Project path: /home/user/myproject
- Start command: npm start
- Port: 3000
- API Endpoints:
  - POST `/articles`: Accepts a JSON object with a `title` string. Returns 201 Created with the created article object (including `id`, `title`, and the generated `slug`).

    ```json
    // Request
    {
      "title": "My First Article"
    }
    ```
    ```json
    // Response
    {
      "id": 1,
      "title": "My First Article",
      "slug": "my-first-article"
    }
    ```

  - POST `/articles/bulk`: Accepts a JSON array of objects with `title` strings. Returns 201 Created with an array of the created article objects (including `id`, `title`, and the generated `slug`).

    ```json
    // Request
    [
      { "title": "Another Post" },
      { "title": "Bulk Insert Test" }
    ]
    ```
    ```json
    // Response
    [
      {
        "id": 2,
        "title": "Another Post",
        "slug": "another-post"
      },
      {
        "id": 3,
        "title": "Bulk Insert Test",
        "slug": "bulk-insert-test"
      }
    ]
    ```

