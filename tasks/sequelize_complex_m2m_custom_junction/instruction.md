# Complex Many-to-Many Association with Custom Junction Table

## Background
In Sequelize, Many-to-Many (N:M) associations connect one source with multiple targets, and vice versa. Sometimes the junction table needs to hold additional information beyond the foreign keys. In this task, you will implement a Many-to-Many relationship with a custom junction table using Sequelize and SQLite in the project directory `/home/user/sequelize-m2m`.

## Requirements
- Set up a Node.js project with Sequelize and SQLite.
- Create three models: `User` (with `username`), `Project` (with `name`), and `UserProject` (with `role`).
- Establish a Many-to-Many association between `User` and `Project` using `UserProject` as the junction model (`through` table).
- Implement a CLI script `cli.js` with two commands:
  - `add <username> <project_name> <role>`: Creates the user (if not exists), the project (if not exists), and associates them with the given role. Upon success, print a confirmation message matching the format: `Success: <username> added to <project_name> as <role>`
  - `list <username>`: Retrieves all projects for a given user, including the custom `role` attribute from the junction table. The output must print a JSON array of objects containing the project name and the user's role in it:
    ```json
    [
      {
        "name": "string",
        "role": "string"
      }
    ]
    ```

## Implementation Hints
- Initialize Sequelize with the SQLite dialect and define the models.
- Use `belongsToMany` on both `User` and `Project` passing the `UserProject` model in the `through` option.
- Ensure the database is synchronized (e.g., using `sequelize.sync()`) before executing queries.
- When querying projects for a user, ensure the junction table attributes are included and properly formatted in the output.
- Use `process.argv` to parse CLI arguments.

