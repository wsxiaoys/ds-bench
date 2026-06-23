# ArkType Discriminated Union Morphs

## Background
Build an ArkType (`arktype@2.2.0`) schema that lives in `/home/user/myproject` and demonstrates how to correctly use a literal discriminator field to combine two branches that morph the **same** payload field in different ways.

You must also produce a sibling TypeScript file that intentionally fails: it must construct an *ambiguous* union (no discriminator) that ArkType refuses to parse, triggering the well-known `ParseError: A union that could apply different morphs to the same data` friction point.

## Requirements
- Implement and export a `PayloadSchema` that is a union of two object branches:
  - One branch whose `kind` is the literal string `"int"` and whose `value` field is morphed from a numeric string into a `number`.
  - One branch whose `kind` is the literal string `"raw"` and whose `value` field stays as a `string`.
- Implement `broken.ts` at the project root which constructs (and *parses*) an ambiguous union and lets ArkType's `ParseError` propagate so the process exits non-zero.

## Acceptance Criteria
- Project path: `/home/user/myproject`
- Command: `npx tsx broken.ts`
  - Exit code MUST be non-zero.
  - The combined stdout+stderr MUST contain the substring `ParseError`.
- `PayloadSchema` MUST be importable as a named export from `/home/user/myproject/src/schema.ts`.
- `PayloadSchema` MUST satisfy the following observable behaviour:
  1. `PayloadSchema({ kind: "int", value: "42" })` returns `{ kind: "int", value: 42 }` (number `42`, NOT a string).
  2. `PayloadSchema({ kind: "raw", value: "42" })` returns `{ kind: "raw", value: "42" }` (string `"42"` preserved).
  3. `PayloadSchema({ kind: "other", value: "42" })` MUST be rejected (the call returns an `arktype` errors instance, i.e. `instanceof type.errors` is `true`).
  4. The `kind` field of `PayloadSchema` MUST be a literal string union (only `"int"` and `"raw"` are accepted).
- ArkType version MUST be exactly `arktype@2.2.0` (declared in `package.json`).

