# ArkType Discriminated Union Morphs

## Background
Build an ArkType (`arktype@2.2.0`) schema that lives in `/home/user/myproject` and demonstrates how to correctly use a literal discriminator field to combine two branches that morph the **same** payload field in different ways.

You must also produce a sibling TypeScript file that intentionally fails: it must construct an *ambiguous* union (no discriminator) that ArkType refuses to parse, triggering the well-known `ParseError: A union that could apply different morphs to the same data` friction point.

## Requirements
- Project path: `/home/user/myproject`
- Ensure `package.json` declares the `arktype` dependency pinned to exactly `2.2.0`.
- Implement and export a `PayloadSchema` as a named export from `/home/user/myproject/src/schema.ts`.
- `PayloadSchema` must be a union of two object branches:
  - One branch whose `kind` is the literal string `"int"` and whose `value` field is morphed from a numeric string into a `number`.
  - One branch whose `kind` is the literal string `"raw"` and whose `value` field stays as a `string`.
- `PayloadSchema` must satisfy the following observable behaviour:
  - `PayloadSchema({ kind: "int", value: "42" })` returns `{ kind: "int", value: 42 }` (number `42`, NOT a string).
  - `PayloadSchema({ kind: "raw", value: "42" })` returns `{ kind: "raw", value: "42" }` (string `"42"` preserved).
  - `PayloadSchema({ kind: "other", value: "42" })` must be rejected (returning an `arktype` errors instance, i.e., `instanceof type.errors` is `true`).
  - The `kind` field of `PayloadSchema` must be a literal string union (only `"int"` and `"raw"` are accepted).
- Implement `broken.ts` at the project root (`/home/user/myproject/broken.ts`) which constructs (and parses) an ambiguous union and lets ArkType's `ParseError` propagate so that running the command `npx tsx broken.ts` exits non-zero and outputs `ParseError` to stdout/stderr.

