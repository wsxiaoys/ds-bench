# ArkType `match`-Based API Response Handler

## Goal
Implement an API response handler at `/home/user/myproject/src/handler.ts` that uses ArkType's `match` API to discriminate between `success`, `error`, and `pending` payload shapes and return a formatted string. Provide an executable entrypoint that reads a single JSON object from stdin and writes the formatted result to stdout.

## Implementation Details
- **Project Structure & Dependencies**:
  - The project is located at `/home/user/myproject`.
  - Ensure `package.json` declares `arktype` at exactly version `2.2.0`.
- **ArkType Matcher Requirements**:
  - The implementation must use ArkType's `match({...})({...})` syntax to handle the payload shapes.
  - Do not use manual `if/else` or `switch` statements on the `status` field to branch or determine the output format.
  - You must import `match` from `'arktype'`.
  - Configure `default: "assert"` in the match definition so that any input matching none of the declared branches will throw an error.
- **Payload Formats & Expected Outputs**:
  - **Success payloads** (`{ "status": "success", "data": <object> }`): Return a string starting with `OK:` followed by the JSON-serialized `data` object.
  - **Error payloads** (`{ "status": "error", "code": <number>, "reason": <string> }`): Return a string starting with `ERR ` followed by the numeric `code` and the `reason` string (e.g., `ERR 404 not found`).
  - **Pending payloads** (`{ "status": "pending" }`): Return the literal string `PENDING`.
- **Executable Entrypoint**:
  - The entrypoint at `src/handler.ts` must read a single JSON object from stdin and write the formatted result to stdout, followed by a newline.
  - It should be executable via the command `npx tsx src/handler.ts`.
  - If a thrown error occurs (such as from an unmatched input), the process must exit with a non-zero status code.
