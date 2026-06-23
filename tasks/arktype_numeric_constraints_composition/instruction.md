# Numeric Constraints Composition (ArkType)

## Goal
Build a TypeScript module under `/home/user/myproject` that validates a `Discount` object using `arktype@2.2.0`. The schema MUST compose multiple numeric constraints (range, divisibility, integer) using ArkType's intersection/string-embedded syntax, and MUST use a custom narrow predicate for the decimal-place check.

## Schema
A `Discount` is an object with exactly these fields:
- `percent`: an integer in the inclusive range `[1, 99]` AND divisible by 5 (i.e. `n % 5 === 0`).
- `amount`: a `number` strictly greater than 0 AND strictly less than 10000 AND with at most 2 decimal places.
- `validityDays`: an integer in the inclusive range `[1, 365]`.
- `appliesTo`: one of the string literals `'cart'`, `'shipping'`, or `'item'`.

## Test Criteria (numbered)
1. A payload with `percent=25`, `amount=99.99`, `validityDays=30`, `appliesTo='cart'` MUST validate successfully.
2. A payload with `percent=100` (out of range) MUST be rejected.
3. A payload with `percent=7` (not divisible by 5) MUST be rejected.
4. A payload with `amount=10000` (boundary excluded) MUST be rejected.
5. A payload with `amount=1.234` (more than 2 decimal places) MUST be rejected.
6. A payload with `validityDays=0` MUST be rejected, and a payload with `validityDays=366` MUST be rejected.
7. A payload with `appliesTo='other'` MUST be rejected.
8. The validator source file MUST embed a numeric range expression (e.g. `1 <= ... <= 99`) and a `% 5` divisibility constraint (verified by regex over the source).

## Acceptance Criteria
- Project path: /home/user/myproject
- Command: `npx tsx cli.ts`
- Input: a single JSON payload representing one `Discount` object, supplied via stdin.
- Output (stdout):
  - If the input validates: print exactly the line `VALID` followed by a newline and the JSON-stringified validated object on the next line.
  - If the input is rejected: print exactly one line starting with `INVALID:` followed by a space and any error description.
- The CLI MUST exit with code 0 for both valid and invalid inputs.
- The validator module MUST live at `src/validator.ts` and export a `validateDiscount(input: unknown)` function.
- The schema MUST combine the numeric range, divisibility, and integer constraints via ArkType's string-embedded intersection syntax.
- The decimal-place check on `amount` MUST be implemented using ArkType's narrow predicate API (NOT a separate regex pre-check before validation).
- `arktype@2.2.0` and `tsx` are preinstalled. `tsconfig.json` is preconfigured with `module: NodeNext` and `moduleResolution: NodeNext`.
