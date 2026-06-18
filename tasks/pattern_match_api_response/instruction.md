# ArkType `match`-Based API Response Handler

## Goal
Implement an API response handler at `/home/user/myproject/src/handler.ts` that uses ArkType's `match` API to discriminate between `success`, `error`, and `pending` payload shapes and return a formatted string. Provide an executable entrypoint that reads a single JSON object from stdin and writes the formatted result to stdout.

## Acceptance Criteria
- Project path: `/home/user/myproject`
- Command: `npx tsx src/handler.ts` (reads one JSON object from stdin)
- `package.json` declares `arktype` at exactly version `2.2.0`.
- The following criteria MUST all hold:
  1. Success payloads (`{ "status": "success", "data": <object> }`) return a string starting with `OK:` containing JSON-serialized `data`.
  2. Error payloads (`{ "status": "error", "code": <number>, "reason": <string> }`) return a string starting with `ERR ` followed by the numeric code and reason.
  3. Pending payloads (`{ "status": "pending" }`) return the literal string `PENDING`.
  4. Any input that matches none of the branches MUST throw (verified via try/catch).
  5. The implementation MUST use `match({...})({...})` syntax (NOT manual `if/else`).
  6. `default: "assert"` MUST be set.
- For the stdin/stdout entrypoint, the returned string is printed (followed by a newline) and a thrown error causes the process to exit with a non-zero status.

