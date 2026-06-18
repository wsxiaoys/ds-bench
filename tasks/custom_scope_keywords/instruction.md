# Custom Scope Keywords Library (ArkType)

## Background
Build a small TypeScript validator library using `arktype@2.2.0` that registers domain-specific keywords inside a single `scope` so they can be reused by bare name in composite schemas. The validator runs from a CLI entry point that consumes a JSON payload from stdin.

## Requirements
In `/home/user/myproject`, build a validator that exposes the following three custom keywords through one ArkType scope:
- `creditCard`: a string of 13 to 19 digits (no whitespace) that passes the Luhn checksum.
- `usPhone`: a string matching the regular expression `^\+?1?[\s-]?\(?\d{3}\)?[\s-]?\d{3}[\s-]?\d{4}$`.
- `slug`: a lowercase string of length 3 to 64 containing only `a-z`, `0-9`, and `-`, with no leading or trailing dash.

The same scope must also define a composite `Order` schema that references the custom keywords by bare name:
```
Order = {
  id: slug,
  customerPhone: usPhone,
  cardNumber: creditCard,
  total: number > 0
}
```

A CLI entry point reads one JSON payload from stdin and validates it against `Order`. On success it prints `VALID` on the first line and the validated JSON-stringified object on the second line. On failure it prints a single line beginning with `INVALID: ` followed by a short error description. The process must always exit with code 0.

## Implementation Hints
- All three custom keywords MUST live inside a single `scope({...})` call and be referenced by their bare alias name from the `Order` schema (do NOT define them as standalone `type(...)` values and stitch them together afterwards).
- The Luhn check for `creditCard` MUST be implemented as a narrow predicate (custom validation logic), not as a regex literal. The digit count constraint can be expressed structurally; only the checksum needs to be in user code.
- For `usPhone`, use ArkType's regex constraint mechanism with the exact pattern shown above.
- For `slug`, the lowercase + length + no-leading/trailing-dash rule may be expressed using any combination of ArkType length constraints, regex constraints, and narrow predicates. The empty string and strings shorter than 3 characters must be rejected.
- The CLI must call the schema's assertion API (or equivalent) and convert thrown ArkType errors into the `INVALID: ...` line. Unexpected JSON parse errors should also surface as `INVALID: ...`.
- The project ships with `arktype@2.2.0`, `tsx`, and a `tsconfig.json` configured for NodeNext. Run TypeScript files directly via `npx tsx`.

## Acceptance Criteria
- Project path: /home/user/myproject
- Command: `npx tsx cli.ts`
- Input: one JSON document representing a candidate `Order`, supplied via stdin.
- Output (stdout):
  - If the input validates: print exactly the line `VALID`, then on the next line the JSON-stringified validated object.
  - If the input is rejected: print exactly one line starting with `INVALID:` followed by a space and any error description.
- Exit code: 0 for both valid and invalid inputs.
- The TypeScript module file `src/keywords.ts` MUST define the three custom keywords (`creditCard`, `usPhone`, `slug`) and the composite `Order` schema inside a single `scope({...})` call and export the resulting module (e.g. via `.export()`).
- `src/keywords.ts` MUST contain at least one narrow predicate (a call to `narrow(...)` or use of the `.narrow(...)` fluent method) used as part of one of the custom keyword definitions.
- An importable `Order` schema must be available from `src/keywords.ts` (e.g. `export const Order = ...` or as a member of the exported scope module).

