# Static + Runtime Tests with @arktype/attest

## Background
The `@arktype/attest` package is the ArkType team's testing library for asserting compile-time TypeScript types and runtime behavior simultaneously. The project at `/home/user/myproject` is a pre-initialized vitest project. Wire up `@arktype/attest` and build a non-trivial test suite that exercises both static and runtime checks for a small set of ArkType schemas.

## Requirements
- Provide an ArkType schema module that defines at least 4 distinct, named ArkType types covering:
  - at least one type built with a morph (input is transformed/parsed into a different shape),
  - at least one type built with a recursive `scope({...}).export()` (a type whose definition references itself),
  - at least one discriminated union (multiple branches selected by a literal tag property),
  - at least one literal-string union (e.g. a fixed set of role names).
- Provide a vitest test file that uses `@arktype/attest`'s `attest` API to make at least 8 assertions across these schemas. The suite MUST exercise all of the following attest surfaces at least once:
  - a pure compile-time type-equality check using the `attest<T>(...)` type-argument form,
  - a `attest(...).type.toString.snap(...)` (or `.equals(...)`) check on a type's serialized string,
  - a runtime `attest(() => ...).throws(...)` check on an ArkType assertion that should fail,
  - a `attest(() => ...).throwsAndHasTypeError(...)` check guarded by `// @ts-expect-error`,
  - a `attest(...).completions({...})` check guarded by `// @ts-expect-error`.
- Wire `@arktype/attest` into vitest using a global setup file so the type assertions and completion snapshots are populated when the test process runs.
- Running the project's test script MUST exit with code `0` and report a passing test run.

## Implementation Hints
- `@arktype/attest`'s vitest integration is documented in its README at https://github.com/arktypeio/arktype/tree/main/ark/attest. The relevant surfaces are `attest`, `attest<T>(...)`, `.type.toString.snap`, `.throws`, `.throwsAndHasTypeError`, `.completions`, and the `setup`/`teardown` lifecycle.
- ArkType's `scope`, morph pipes (`"|>"` / `"=>"`) and discriminated-union shape are documented at https://arktype.io/docs/.
- The project's `package.json`, `tsconfig.json` and `node_modules` are already preinstalled. You only need to add source/test files and any attest/vitest configuration files required by the contract above.
- The deliberately-broken type expressions guarded by `// @ts-expect-error` are essential: without them the project would fail to typecheck, so think carefully about which assertions need them.

## Acceptance Criteria
- Project path: /home/user/myproject
- Command: `npm test` (run from the project root)
- The command MUST exit with code `0`.
- The vitest run MUST report at least one test file with all tests passing.
- A schema source file under `/home/user/myproject/src/` MUST define at least 4 distinct named ArkType types, including at least one defined via a `scope({...}).export()` call and at least one defined with an ArkType morph pipe (`"|>"` or `"=>"` operator, or via `["...", "|>", ...]` / `["...", "=>", ...]` tuple form).
- A vitest test source file under `/home/user/myproject/tests/` (or similar) MUST contain:
  - at least 8 calls to the `attest(...)` API,
  - at least one call to `.throwsAndHasTypeError(...)`,
  - at least one call to `.throws(...)` on a thunk,
  - at least one call to `.completions({...})`,
  - at least one type-equality assertion of the form `attest<...>(...)` (with an explicit type argument),
  - at least one call to either `.type.toString.snap(...)` or `.type.toString.equals(...)`,
  - at least one `// @ts-expect-error` directive (immediately preceding a `attest(...)` call that would otherwise be a compile-time error).
- A vitest configuration file at `/home/user/myproject/vitest.config.ts` (or equivalent) MUST register a `globalSetup` entry that calls `@arktype/attest`'s `setup({...})`.

