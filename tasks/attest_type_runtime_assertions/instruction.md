# ArkType `@arktype/attest` Test Suite

## Goal

In the existing project at `/home/user/myproject`, build a Vitest test suite that uses `@arktype/attest` to assert both compile-time inferred types and runtime/TypeScript errors of ArkType schemas.

## Acceptance Criteria

- Project path: `/home/user/myproject`
- Command: `npx vitest run` (executed from the project root)
- Running the command MUST exit with code 0 and report all tests passed.
- The test suite MUST include an `attest<number>(...)` call that succeeds against the inferred output of a `string.numeric.parse` ArkType schema.
- The test suite MUST include an assertion using `.throwsAndHasTypeError(...)` that targets `type("number%0")` and matches the text `"% operator must be followed by a non-zero integer literal (was 0)"`.
- The `vitest.config.ts` (or equivalent) MUST register the `@arktype/attest` setup as documented by the library.

