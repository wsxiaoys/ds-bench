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
- The CLI should print error messages via `INVALID: <msg>` and JSON results via `VALID` followed by the serialized records. Always exit with code 0 so that downstream tooling can distinguish success from failure via stdout alone.
- `tsx` is preinstalled and is the intended runtime. The `tsconfig.json` is already configured for `NodeNext`.

## Acceptance Criteria
- Project path: /home/user/myproject
- Command: `npx tsx cli.ts`
- Input: a single raw CSV string supplied verbatim on stdin (it may contain trailing newlines).
- Output (stdout):
  - On success: the first non-empty line is exactly `VALID`; the second non-empty line is a JSON array of records. Each record has the shape `{"id": string, "age": number, "email": string, "signupAt": string}` where `signupAt` is serialized as an ISO-8601 string (the same value that `Date.prototype.toISOString()` would produce after the morph). The records must appear in the same order as the rows in the input CSV.
  - On failure: a single non-empty line of the form `INVALID: <message>` where `<message>` is any non-empty diagnostic.
- Exit code: `0` for both success and failure.
- The TypeScript pipeline implementation must live at `/home/user/myproject/src/pipeline.ts`.
- `arktype@2.2.0` and `tsx` are preinstalled. `tsconfig.json` is preconfigured with `module: NodeNext` and `moduleResolution: NodeNext`.

