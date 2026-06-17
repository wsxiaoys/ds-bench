# Validated Async Fetch Wrapper (ArkType `type.fn`)

## Background
Build a TypeScript module under `/home/user/myproject` that defines a runtime-validated asynchronous fetch wrapper using `arktype@2.2.0`. The wrapper simulates a network call (no real I/O) but enforces strict validation on both its parameters and the resolved response shape. Invalid inputs must be rejected at the validation boundary BEFORE any asynchronous work is scheduled.

## Requirements
- Define a validated async function `fetchWithTimeout` using ArkType's `type.fn`.
- The single parameter is an object with the following fields:
  - `url`: a URL string (the built-in URL keyword in arktype, which accepts both `http://` and `https://`).
  - `timeoutMs`: an integer strictly greater than `0` and at most `10000`.
  - `retries`: an integer between `0` and `5` inclusive.
- The function MUST return a `Promise` that resolves to a validated object with:
  - `status`: an integer in `[100, 599]`.
  - `body`: a string.
- The implementation must use `setTimeout` to simulate a network call and ALWAYS resolve with `{ status: 200, body: "ok" }` after `min(timeoutMs, 50)` milliseconds (so tests stay fast).
- Parameter validation MUST happen synchronously at the `type.fn` boundary, BEFORE any `setTimeout` is scheduled.
- A CLI entrypoint `cli.ts` reads a single JSON document `{ "params": { ... } }` from stdin, awaits a single call to `fetchWithTimeout`, and writes the result to stdout.
  - On success: a single line `OK <json>` where `<json>` is the JSON-serialized resolved response.
  - On any validation failure (synchronous throw or rejected promise from validation): a single line `ERR <msg>` where `<msg>` is any non-empty human-readable error description.
  - The CLI MUST exit with code `0` for both success and validation-failure paths.

## Implementation Hints
- Use `type.fn` to enforce both the parameter shape and the (Promise) return shape of the wrapper.
- The resolved-value shape (`{ status, body }`) must itself be validated by an arktype `Type`, so that the runtime resolution is guaranteed to satisfy the declared contract.
- Schedule the `setTimeout` inside an `async` body so that any throw raised by parameter validation occurs before the timer is created.
- Use `await` inside the CLI to capture both synchronous throws and rejected promises before formatting the `OK`/`ERR` line.

## Acceptance Criteria
- Project path: /home/user/myproject
- Command: `npx tsx cli.ts`
- Input: a single JSON document `{ "params": { "url": string, "timeoutMs": number, "retries": number } }` provided via stdin.
- Output (stdout):
  - On success: a single line `OK <json>` where `<json>` is the JSON-serialized resolved response object.
  - On validation failure: a single line `ERR <msg>` where `<msg>` is any non-empty error description.
- Exit code: `0` for both success and validation-failure paths.
- Implementation files:
  - `/home/user/myproject/src/validator.ts` MUST export the validated wrapper as `fetchWithTimeout`.
  - `/home/user/myproject/cli.ts` MUST import that wrapper and drive it from stdin.
- The validator source MUST be built with arktype's `type.fn` and MUST model the return value as a `Promise` of a validated shape (so that both parameter validation and resolved-value validation are anchored in arktype).
- `arktype@2.2.0` and `tsx` are preinstalled. `tsconfig.json` is preconfigured with `module: NodeNext` and `moduleResolution: NodeNext`.

