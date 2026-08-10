# JSON Path Query Engine (Sequelize + SQLite)

A rerunnable CLI query engine over a product catalog stored in SQLite via
Sequelize v6. Products carry a nested JSON `attributes` document, and every
filter/update is evaluated by the database (via SQLite's `json_extract`,
`json_each`, and `json_set` functions) rather than in application memory.

## Install

```bash
npm install
```

## Usage

```bash
node cli.js <command> --db <path> [options]
```

`--db` defaults to `./data.sqlite` if omitted.

### Commands

* **load** — replace the entire product table with the contents of a JSON file.

  ```bash
  node cli.js load --db ./data.sqlite --file ./sample-data.json
  ```

  The file must be a JSON array of `{ "name": string, "attributes": object }`
  objects. Products are inserted in array order, so the first element gets
  `id` 1. The table schema is (re)created automatically.

* **filter-num** — filter by a numeric comparison at a nested path.

  ```bash
  node cli.js filter-num --db ./data.sqlite --path specs.ram --op gt --value 16
  ```

  `--op` is one of `eq|gt|gte|lt|lte`. Comparisons use numeric semantics
  (`128 > 16`), not lexicographic string comparison.

* **filter-str** — filter by exact string equality at a nested path.

  ```bash
  node cli.js filter-str --db ./data.sqlite --path specs.cpu --value i9
  ```

* **filter-tag** — filter by exact array-element membership at a nested path.

  ```bash
  node cli.js filter-tag --db ./data.sqlite --path tags --value laptop
  ```

  Matches an exact array element only — never a substring of the serialized
  document or a value found elsewhere in the JSON.

* **set-key** — set a nested key on a single product by id, preserving every
  other key/branch of the document, then print the updated product.

  ```bash
  node cli.js set-key --db ./data.sqlite --id 1 --path specs.ram --json 32
  node cli.js set-key --db ./data.sqlite --id 1 --path specs.cpu --json '"i9"'
  node cli.js set-key --db ./data.sqlite --id 1 --path specs.turbo --json true
  ```

  Exits with a non-zero status and writes an error to stderr if the id does
  not exist.

### Output

Filter commands print a single JSON array of `{ id, name, attributes }`
objects ordered by `id` ascending (`[]` if there are no matches). `set-key`
prints a single updated `{ id, name, attributes }` object.

### SQL logging

Set the `SQL_LOG` environment variable to a file path to append every SQL
statement executed against the database (one per line, in execution order)
to that file:

```bash
SQL_LOG=./sql.log node cli.js load --db ./data.sqlite --file ./sample-data.json
```

## Project layout

* `cli.js` — argument parsing and command dispatch.
* `lib/db.js` — Sequelize instance + `Product` model setup, SQL logging hook.
* `lib/jsonPath.js` — converts dot paths (`specs.ram`) into SQLite JSON path
  expressions (`$."specs"."ram"`).
* `lib/queries.js` — the load/filter/update database operations.
