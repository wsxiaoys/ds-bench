# Advanced Association Scopes and Nested Includes

## Background
A common challenge in Sequelize is correctly querying deeply nested associations while applying specific scopes and aliases. In this task, you will model an organizational structure and write a script that fetches deeply nested data with specific conditions and aliases.

## Requirements
- Define the following Sequelize models: `Company`, `Department`, `Employee`, `Project`, and `EmployeeProject` (junction table) using SQLite.
- Establish the following associations:
  - `Company` has many `Department`s (alias: `divisions`).
  - `Department` belongs to `Company`.
  - `Department` has many `Employee`s (alias: `staff`).
  - `Employee` belongs to `Department`.
  - `Employee` belongs to many `Project`s through `EmployeeProject` (alias: `assignments`).
  - `Project` belongs to many `Employee`s through `EmployeeProject`.
- Add a default scope to `Project` that only includes projects where `status` is `'active'`.
- Write a Node.js script `query.js` that:
  1. Connects to a SQLite database (`database.sqlite`).
  2. Syncs the models.
  3. Seeds some sample data to demonstrate the nested associations and scopes.
  4. Performs a single query to find a company by name ('TechCorp'), eagerly loading its `divisions`, their `staff`, and the staff's `assignments` (which should automatically only include active projects due to the scope).
  5. Writes the query result as a JSON string to `output.json`.

## Implementation Hints
- Project path: /home/user/myproject
- Ensure you define the aliases (`as` option) in both the model associations and the `include` statements of the query.
- Remember that when querying with aliases, the `include` array must specify the exact alias used in the association.
- Scopes are defined in the model options and can be automatically applied if configured as a `defaultScope`, or applied manually using `.scope()`.

