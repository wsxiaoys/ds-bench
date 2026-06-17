# Sequelize Migration: Add Column, Backfill Data, and Add Foreign Key

## Background
In this task, you will write a Sequelize migration script to safely add a new column to an existing table, backfill it with default data, and then add a foreign key constraint to it. This is a common real-world scenario when evolving a database schema.

## Requirements
- You are provided with an existing SQLite database and a basic Sequelize setup in `/home/user/project`.
- The database has two tables: `Departments` (id, name) and `Users` (id, name), created by initial migrations.
- Create a new migration using `sequelize-cli` that performs the following steps in its `up` method:
  1. Adds a `departmentId` column of type `INTEGER` to the `Users` table.
  2. Backfills existing rows in the `Users` table by setting `departmentId` to `1` (assuming a department with ID 1 already exists).
  3. Adds a foreign key constraint to the `departmentId` column, referencing the `id` column of the `Departments` table, with `CASCADE` on update and delete.
- The `down` method should revert these changes (remove the constraint and the column).

## Implementation Hints
- Use `queryInterface.addColumn()` to add the column.
- Use `queryInterface.bulkUpdate()` to backfill the data.
- Use `queryInterface.addConstraint()` to add the foreign key constraint.
- Make sure to return a Promise or use `async/await` in your migration functions.
- The migration should be placed in the `migrations` folder.

## Acceptance Criteria
- Project path: /home/user/project
- Ensure the migration script is created and can be executed.
- Executing `npx sequelize-cli db:migrate` must successfully apply the migration.
- After migration, the `Users` table must have a `departmentId` column.
- Existing user records must have their `departmentId` set to `1`.
- The `departmentId` column must have a foreign key constraint referencing `Departments(id)`.
- Executing `npx sequelize-cli db:migrate:undo` must successfully revert the migration, removing the column and constraint.

