# Sequelize Composite Primary Key and Upsert

## Background
Create a simple REST API using Express.js and Sequelize (with SQLite) to manage user role assignments. The assignments use a composite primary key to ensure a user can only have a specific role once, but the assignment details can be updated.

## Requirements
- Work in the project directory `/home/user/project`.
- Initialize a Sequelize instance with SQLite.
- Define a `UserRole` model with a composite primary key consisting of `userId` (INTEGER) and `roleId` (INTEGER).
- Include an `assignedBy` (STRING) column and an `isActive` (BOOLEAN, default `true`) column.
- Create an Express.js server in `index.js` listening on port `3000`.
- Implement a REST API with the following endpoints:
  - `POST /roles`: Assigns a role to a user.
    - Accepts a JSON body:
      ```json
      {
        "userId": number,
        "roleId": number,
        "assignedBy": string
      }
      ```
    - Uses `UserRole.upsert()` to create the record or update `assignedBy` and set `isActive` to `true` if it already exists.
    - Returns 200 OK with the upserted record:
      ```json
      {
        "userId": number,
        "roleId": number,
        "assignedBy": string,
        "isActive": boolean
      }
      ```
  - `GET /roles/:userId/:roleId`: Retrieves the role assignment.
    - Returns 200 OK with the role assignment object (containing `userId`, `roleId`, `assignedBy`, and `isActive`), or 404 Not Found if it doesn't exist.

## Implementation Hints
- Use `sequelize.define` or `Model.init` with `primaryKey: true` on both `userId` and `roleId` to create the composite primary key.
- Use `UserRole.upsert()` for the POST endpoint. Sequelize's `upsert` will automatically insert a new row or update the existing row based on the primary key.
- Ensure you call `sequelize.sync()` to create the table before starting the server.

