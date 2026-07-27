# Typesense Visual Filter Chip Builder

## Background
Build a single-page web application that lets a user visually compose a complex boolean filter as a tree of "chips" and apply it against a Typesense-backed product catalog. A local Typesense server (v26.0) is available; your application must index a provided dataset and translate the visually composed filter tree into a correct Typesense `filter_by` expression, then show the exact matching products.

## Requirements
- Provide a UI to build a filter tree made of **condition chips** and **nested AND / OR groups** (the UI must allow at least two levels of group nesting), apply the composed filter, and display the exact set of matching products (each result showing its product `id` and `name`) together with a total count of matches.
- Condition chips must support, at minimum: string equality, numeric comparison, inclusive numeric ranges, and set membership (a field value being one of a set of values; and for the array field, the array containing one of a set of values).
- Provide a backend route that accepts a structured JSON description of the filter tree and returns the exact set of matching document ids from Typesense.
- Values that contain characters which are significant in the filter grammar must still match **literally** and must not corrupt the composed expression.
- The result of a filter tree must respect the grouping/precedence of its nodes, so two trees built from the same leaf conditions but grouped differently can yield different result sets.
- The reported matches must be the complete set Typesense returns for the composed filter, even when more than ten documents match.

## Dataset
A dataset is provided at `/home/user/filterchip/data/products.jsonl` (JSONL; one product object per line). Your server MUST index exactly these documents (no additions, no omissions) into a Typesense collection named `products`. The documents have these fields:
- `id` (string)
- `name` (string)
- `category` (string)
- `brand` (string)
- `price` (float)
- `rating` (float)
- `tags` (array of string)

## Implementation Hints
- Project path: /home/user/filterchip
- A Typesense **v26.0** server is running and reachable at `http://127.0.0.1:8108`; its API key is provided in the file `/etc/typesense-api-key`.
- Provide an executable start script at `/home/user/filterchip/start.sh` that launches your web server in the foreground, listening on port **8080**, and keeps running until terminated. Starting the server must not require any interactive input.
- Port: 8080
- Routes:
  - `GET /` — serves the filter-builder UI (HTML page).
  - `POST /api/filter` — described below.

### `POST /api/filter`
Request body (JSON):

```json
{ "filter": <Node> }
```

A `<Node>` is either a **Group** or a **Condition**.

Group node:

```json
{ "op": "and" | "or", "children": [ <Node>, ... ] }
```

A group whose `children` array is empty applies no constraint (it matches every document).

Condition node:

```json
{ "field": <string>, "cmp": <comparator>, "value": <value> }
```

Comparators and their `value` shapes:
- `"eq"` / `"ne"`: `value` is a string or number — field is (not) equal to the value. For string fields this is a full-value exact match.
- `"gt"`, `"gte"`, `"lt"`, `"lte"`: `value` is a number — numeric comparison (applies to `price` and `rating`).
- `"between"`: `value` is `[low, high]` — inclusive numeric range.
- `"in"`: `value` is an array of scalars — for a scalar field it matches when the field equals any listed value; for the array field `tags` it matches when the document's `tags` contains at least one listed value.

Response (HTTP `200`), JSON:

```json
{ "ids": [<string>, ...], "count": <number> }
```

`ids` is the complete set of matching document ids (order does not matter); `count` MUST equal the number of ids returned. If any condition's `field` is not one of the seven schema fields listed above, respond with HTTP `400`.

