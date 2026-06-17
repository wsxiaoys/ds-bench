# Express Validator via Standard Schema Interface (ArkType)

## Background
ArkType implements the [Standard Schema](https://standardschema.dev) specification: every schema exposes a `~standard` property with a `validate(value)` method that returns either a typed success result or a list of issues. Build a small Express service that performs ALL request validation through this vendor-neutral interface — not through ArkType's own `.assert()` / direct-invocation APIs.

## Requirements
- Implement an Express HTTP service in `/home/user/myproject` listening on port 3000.
- Define two ArkType schemas (using `arktype@2.2.0`):
  - A body schema for `POST /users` with `username` (alphanumeric, length 3..20), `email` (valid email), and an optional `age` (integer in [13, 120]).
  - A query schema for `GET /search` with `q` (string, length 1..100), `page` (integer >= 1), and `limit` (integer in [1, 50]). Because Express query values arrive as strings, the schema MUST coerce strings to numbers using ArkType morphs (a single declarative pipeline — no `JSON.parse`, `parseInt`, or other hand-written coercion).
- Implement a reusable middleware factory `validate(source, schema)` where `source` is either `'body'` or `'query'`. It MUST:
  - Drive validation exclusively through the Standard Schema interface (i.e. call the schema's `~standard.validate(...)` and inspect its `value` / `issues`).
  - On success: replace `req[source]` with the validated/coerced value and call `next()`.
  - On failure: respond with HTTP 400 and a JSON body containing an `issues` array.
- Wire both routes through `validate(...)`. On success:
  - `POST /users` responds `201` with a JSON body echoing the validated user.
  - `GET /search` responds `200` with a JSON body echoing the validated/coerced query (numeric `page` and `limit`).

## Implementation Hints
- Read the Standard Schema spec at https://standardschema.dev to understand the exact shape of `~standard.validate` and its result type.
- ArkType morphs (the `|>` / pipe operator) can be used to coerce a string into a number before applying further numeric constraints; consult https://arktype.io/docs/expressions for available expressions.
- The middleware must remain schema-agnostic: it should work with any object that satisfies the Standard Schema interface, regardless of which library produced it.
- Treat the schema's `validate` result as potentially asynchronous (it may return a Promise).

## Acceptance Criteria
- Project path: /home/user/myproject
- Start command: `npx tsx server.ts`
- Port: 3000
- API Endpoints:
  - `POST /users`
    ```json
    // Request body
    { "username": string, "email": string, "age": number /* optional */ }
    ```
    ```json
    // 201 Response
    { "username": string, "email": string, "age": number /* if provided */ }
    ```
    On validation failure: status `400` with body `{ "issues": [ { "message": string, ... } , ... ] }`.
  - `GET /search?q=...&page=...&limit=...`
    ```json
    // 200 Response
    { "q": string, "page": number, "limit": number }
    ```
    `page` and `limit` MUST be numbers in the response (coerced from the incoming string query values).
    On validation failure: status `400` with body `{ "issues": [ ... ] }`.
- The middleware factory MUST be defined in source and its implementation MUST reference the Standard Schema property literally (the string `~standard` must appear in the middleware source).
- `arktype@2.2.0`, `express`, and `tsx` are preinstalled in `/home/user/myproject`.

