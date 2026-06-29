# CSV Morph Pipeline (ArkType)

## Background
Build a CSV-to-records ingestion pipeline using `arktype@2.2.0`. The pipeline must accept a raw CSV string on stdin and either emit a strongly-typed array of user records (with the `signupAt` column converted to a real `Date`) or reject the input with a clear error message. The objective is to compose ArkType morphs into a single end-to-end transformation rather than to perform validation in plain JavaScript.

## Requirements
- Project root: `/home/user/myproject`.
- The pipeline reads the entire raw CSV from stdin verbatim. Do not trim or normalize the bytes before they reach the ArkType pipeline.
- The CSV must begin with a header row that is exactly `id,age,email,signupAt` (case-sensitive, no leading or trailing whitespace, no extra columns). A missing, reordered, or otherwise altered header row must be rejected.
- Each data row must have exactly four comma-separated cells and is validated as a record with the following fields:
  - `id`: a UUID string.
  - `age`: an integer in the inclusive range `[0, 150]`.
  - `email`: an email address.
  - `signupAt`: an ISO-8601 date string that is parsed into a real `Date` instance as part of validation.
- The pipeline must short-circuit and reject with a descriptive error if any cell fails its constraint, if a row has the wrong number of columns, if the header is malformed, or if the input is empty (no header row at all).
- The final inferred output type of the pipeline must be a strongly-typed array of user records (with `signupAt` typed as `Date`).

## Implementation Hints
- This task exists specifically to exercise ArkType morphs and the `to` / pipe operator. The implementation must compose at least one explicit morph pipe (not a single inline object schema); the ISO date column in particular must reach `Date` via a morph rather than via a hand-rolled `new Date(...)` call after validation.
- Use ArkType to validate every constraint that is part of the record shape (UUID, email, integer range, ISO date). Do not duplicate those constraints with hand-written `if` checks in TypeScript.
- The CSV parsing step itself (splitting lines, splitting cells, checking the header and column counts) is the natural place for a user-defined morph that takes a `string` and produces an array of raw record-shaped objects which are then piped into record validation.
- Reach for ArkType's built-in `string.*` keywords where appropriate; the docs at https://arktype.io/docs/primitives and https://arktype.io/docs/expressions cover the available primitives and the pipe operator.
- The CLI entrypoint must be `cli.ts` in the project root. It should print error messages via `INVALID: <msg>` on a single line. On success, it must print exactly `VALID` on the first line and the JSON array of serialized records on the second line. Always exit with code 0 so that downstream tooling can distinguish success from failure via stdout alone.
- `tsx` is preinstalled and is the intended runtime. The `tsconfig.json` is already configured for `NodeNext`. The TypeScript pipeline implementation must live at `/home/user/myproject/src/pipeline.ts`.

