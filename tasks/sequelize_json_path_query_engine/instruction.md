# Sequelize JSON Path Query Engine (SQLite)

## Background
You are building a command-line query engine over a product catalog stored in SQLite through Sequelize (v6). Each product carries a nested JSON document in an `attributes` column, and the engine must filter and update products by nested JSON paths at the database level.

## Requirements
- Define a Sequelize model `Product` backed by the SQLite dialect with the columns: `id` (auto-increment integer primary key), `name` (string), and `attributes` (JSON). The `attributes` document is an arbitrary nested object that may contain nested objects and arrays, for example: `{ "specs": { "ram": 16, "cpu": "i7", "storageGB": 512 }, "tags": ["gaming", "laptop"], "dimensions": { "w": 30, "h": 2, "d": 21 }, "price": 1200 }`.
- Provide a rerunnable CLI that supports loading data and the query/update operations described below.
- Filtering must be evaluated by the database against the JSON column in a nested-path-aware way. Loading rows into application memory and filtering them there is not acceptable.
- Numeric comparisons must use numeric semantics (for example, the value `128` is greater than `16`), not lexicographic string comparison.
- Array membership must match an exact array element, and must never match a mere substring of the serialized JSON or a value found elsewhere in the document.
- Updating a nested key must preserve every sibling key and every unrelated branch of the JSON document.

## Implementation Hints
- Project path: /home/user/project
- Target: Sequelize v6 with the SQLite dialect.
- Command: `node cli.js <command> [options]`. Every command accepts `--db <path>` giving the path to the SQLite database file (default `./data.sqlite`).
- Commands:
  - `load --db <path> --file <path>`: Replace the entire product table with the products contained in the given JSON file, creating the schema if needed. The file is a JSON array of objects of the form `{ "name": string, "attributes": object }`, and products are inserted in array order (so the first element receives `id` 1). Exit with status 0 on success.
  - `filter-num --db <path> --path <dotPath> --op <eq|gt|gte|lt|lte> --value <number>`: Print a JSON array of the products whose numeric value at `attributes.<dotPath>` satisfies the comparison. `<dotPath>` is a dot-separated path relative to the root of `attributes` (for example `specs.ram`).
  - `filter-str --db <path> --path <dotPath> --value <string>`: Print a JSON array of the products whose string value at `attributes.<dotPath>` is exactly equal to `<value>`.
  - `filter-tag --db <path> --path <dotPath> --value <string>`: Print a JSON array of the products for which the JSON array located at `attributes.<dotPath>` contains an element exactly equal to `<value>`.
  - `set-key --db <path> --id <id> --path <dotPath> --json <jsonLiteral>`: Set the nested key at `attributes.<dotPath>` of the product with the given `id` to the value parsed from `<jsonLiteral>` (a valid JSON literal such as `32`, `"i9"`, or `true`), leaving every other key of the document unchanged, then print the updated product. If no product has that id, exit with a non-zero status and write an error message to stderr.
- Output shape: every product emitted by a command (filter results and `set-key`) is a JSON object with exactly the keys `id` (number), `name` (string), and `attributes` (the parsed nested object). Filter commands print a single JSON array ordered by `id` ascending, and an empty result set is printed as `[]`. All command output is written to stdout.
- SQL recording: when the environment variable `SQL_LOG` is set to a file path, every SQL statement your program executes against the database must be appended to that file, one statement per line, in execution order.

