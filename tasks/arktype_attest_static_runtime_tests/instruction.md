# Static + Runtime Tests with @arktype/attest

## Background
The `@arktype/attest` package is the ArkType team's testing library for asserting compile-time TypeScript types and runtime behavior simultaneously. The project at `/home/user/myproject` is a pre-initialized vitest project. Wire up `@arktype/attest` and build a non-trivial test suite that exercises both static and runtime checks for a small set of ArkType schemas.

## Requirements
- Provide an ArkType schema module under `/home/user/myproject/src/` that imports from `'arktype'` and defines at least 4 distinct named ArkType types as named exports covering:
  - at least one type built with an ArkType morph pipe (`"|>"` or `"=>"` operator, or via `["...", "|>", ...]` / `["...", "=>", ...]` tuple form),
  - at least one type built with a recursive `scope({...}).export()` (a type whose definition references itself),
  - at least one discriminated union (multiple branches selected by a literal tag property),
  - at least one literal-string union (e.g. a fixed set of role names).
- Provide a vitest test file (e.g., `*.test.ts` or `*.spec.ts` under `/home/user/myproject/tests/`) that imports from `'@arktype/attest'` and uses `@arktype/attest`'s `attest` API to make at least 8 assertions across these schemas. The suite MUST exercise all of the following attest surfaces at least once:
  - a pure compile-time type-equality check using the `attest<T>(...)` type-argument form,
  - a `attest(...).type.toString.snap(...)` (or `.equals(...)`) check on a type's serialized string,
  - a runtime `attest(() => ...).throws(...)` check on an ArkType assertion that should fail (on a thunk),
  - a `attest(() => ...).throwsAndHasTypeError(...)` check guarded by a `// @ts-expect-error` directive immediately preceding the `attest(...)` call,
  - a `attest(...).completions({...})` check guarded by a `// @ts-expect-error` directive immediately preceding the `attest(...)` call.
- Wire `@arktype/attest` into vitest using a configuration file at `/home/user/myproject/vitest.config.ts` registering a `globalSetup` entry. The referenced global setup file (e.g., `setupVitest.ts` at the project root) must import `setup` from `'@arktype/attest'` and call `setup(...)` so the type assertions and completion snapshots are populated when the test process runs.
- Running the project's test script (`npm test` run from `/home/user/myproject`) MUST exit with code `0` and report a passing test run.

## Implementation Hints
- `@arktype/attest`'s vitest integration is documented in its README at https://github.com/arktypeio/arktype/tree/main/ark/attest. The relevant surfaces are `attest`, `attest<T>(...)`, `.type.toString.snap`, `.throws`, `.throwsAndHasTypeError`, `.completions`, and the `setup`/`teardown` lifecycle.
- ArkType's `scope`, morph pipes (`"|>"` / `"=>"`) and discriminated-union shape are documented at https://arktype.io/docs/.
- The project's `package.json`, `tsconfig.json` and `node_modules` are already preinstalled. You only need to add source/test files and any attest/vitest configuration files required by the contract above.
- The deliberately-broken type expressions guarded by `// @ts-expect-error` are essential: without them the project would fail to typecheck, so think carefully about which assertions need them.

