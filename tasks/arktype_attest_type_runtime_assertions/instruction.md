# ArkType `@arktype/attest` Test Suite

## Goal

In the existing project at `/home/user/myproject`, build a Vitest test suite that uses `@arktype/attest` to assert both compile-time inferred types and runtime/TypeScript errors of ArkType schemas.

## Implementation Hints

- Ensure your `vitest.config.ts` (or equivalent) registers the `@arktype/attest` setup as documented by the library.
- The test suite must include an `attest<number>(...)` call that succeeds against the inferred output of a `string.numeric.parse` ArkType schema.
- The test suite must include an assertion using `.throwsAndHasTypeError(...)` that targets `type("number%0")` and matches the exact error text `"% operator must be followed by a non-zero integer literal (was 0)"`.

