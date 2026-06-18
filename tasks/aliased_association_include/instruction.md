# Sequelize Aliased Associations

## Background
You need to build a small script using Sequelize and SQLite to manage `Person` and `Mail` records. You must establish two relationships between them so a `Mail` has a `sender` and a `receiver`. Many developers encounter the "Include unexpected" error when trying to eager load associations with aliases if the aliases are not defined correctly.

## Requirements
- Initialize a Sequelize instance using SQLite.
- Create a `Person` model with a `name` (STRING) field.
- Create a `Mail` model with a `content` (STRING) field.
- Define associations such that a `Mail` belongs to a `Person` as a `sender`, and also belongs to a `Person` as a `receiver`.
- Write a script `index.js` that:
  1. Connects to a SQLite database at `./database.sqlite`.
  2. Syncs the models.
  3. Creates two persons: "Alice" and "Bob".
  4. Creates a mail with content "Hello" where the sender is "Alice" and the receiver is "Bob".
  5. Queries the mail from the database, eager loading BOTH the sender and the receiver using their aliases.
  6. Prints the result to stdout in a specific format.

## Implementation Hints
- Use `belongsTo` with the `as` option to define the `sender` and `receiver` aliases on the `Mail` model.
- When querying with `findOne` or `findAll`, use the `include` option with the exact aliases to eager load the associated models and avoid the "Include unexpected" error.
- Use `sequelize.sync({ force: true })` to ensure the database is clean on each run.

## Acceptance Criteria
- Project path: /home/user/myproject
- Command: `node index.js`
- The script must execute without errors.
- The stdout should print the fetched mail's information in exactly this format: `Result: Alice sent "Hello" to Bob`
- The database file `./database.sqlite` must be created and contain the correct tables and foreign keys.

