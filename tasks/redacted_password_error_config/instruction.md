# Redacted Sign-Up Validator with Per-Type Error Configuration (ArkType)

## Background
You are building the credential intake layer of a sign-up service. The service receives a JSON payload from clients and must validate it with `arktype@2.2.0`. Because validation errors are routinely shipped to log aggregation, observability tooling, and customer-facing toasts, the raw value of any sensitive field MUST NEVER appear in the error output — even when the field is nested inside an array or string.

The project is preinstalled at `/home/user/myproject` with `arktype@2.2.0` and `tsx` already available; you only need to write the validator and the CLI.

## Requirements
- Implement an ArkType schema that validates the sign-up object with the following shape:
  - `username`: alphanumeric string, length 3 through 20 inclusive.
  - `password`: string of length 12 through 128 inclusive that contains at least one lowercase letter, at least one uppercase letter, at least one digit, and at least one symbol (non-alphanumeric character).
  - `confirm`: must satisfy the same constraints as `password` AND be equal to the supplied `password` value.
  - `ssn`: string matching the pattern `^\d{3}-\d{2}-\d{4}$`.
- Apply ArkType per-type error configuration so that ANY validation error attributable to `password`, `confirm`, or `ssn` produces an error description in which both the `actual` and `problem` text contain the literal token `<redacted>` instead of the raw input value. The raw value of these three fields MUST NEVER appear in any error message, including when echoed inside `actual`, `problem`, `message`, or any other field of the serialized error.
- The configuration MUST be applied at the per-type level (not as a global or scope-level config) on the three sensitive field types.
- Build a CLI entrypoint that reads a single JSON object from stdin and:
  - On success: prints `VALID` on the first line and the JSON-stringified validated object on the second line. Exit code 0.
  - On failure: prints exactly one line starting with `INVALID: ` followed by the full structured error JSON (the serialized `ArkErrors` value, which contains `byPath` entries). Exit code 0.
- Other (non-sensitive) fields such as `username` may have their original values echoed in error messages — only `password`, `confirm`, and `ssn` must be redacted.

## Implementation Hints
- The validator lives in `/home/user/myproject/src/validator.ts` and the CLI lives in `/home/user/myproject/cli.ts`.
- The CLI is invoked as `npx tsx cli.ts` from `/home/user/myproject`, with the JSON payload piped through stdin.
- ArkType error output is JSON-stringifiable via `JSON.stringify(errors)`; the structured form exposes paths grouped under a `byPath`-style key.
- You will need to combine narrowing/refinement and length constraints to enforce the password complexity rules.
- The `confirm` field must enforce both the password complexity rules AND equality with `password`; consider where in the schema the equality check belongs so that any mismatch error also avoids leaking the confirm value.
- The error configuration must be expressed at the type level of the sensitive fields, not as a global setting.

## Acceptance Criteria
- Project path: /home/user/myproject
- Command: `npx tsx cli.ts` (run from the project directory).
- Input: a single JSON object representing the sign-up payload, supplied via stdin.
- Output (stdout):
  - On valid input: line 1 is exactly `VALID`; line 2 is the JSON-stringified validated object.
  - On invalid input: a single line starting with `INVALID: ` followed by the JSON-stringified ArkType error value. The serialized JSON must include a `byPath` field (e.g. `byPath`, `flatByPath`, or `flatProblemsByPath`).
- The CLI MUST exit with code 0 regardless of whether validation succeeded or failed (the leading stdout token decides the outcome).
- The raw value of `password`, `confirm`, or `ssn` MUST NEVER appear anywhere in stdout when validation fails for those fields; the literal token `<redacted>` MUST appear instead.
- The validator source `/home/user/myproject/src/validator.ts` MUST call `.configure(` and reference at least one of the keys `actual` or `problem`.
- `arktype@2.2.0` and `tsx` are preinstalled. `tsconfig.json` is preconfigured with `module: NodeNext` and `moduleResolution: NodeNext`.

