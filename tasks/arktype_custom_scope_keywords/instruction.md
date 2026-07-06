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
- The TypeScript module defining the scope and schemas MUST be located at `src/keywords.ts` and export the resulting scope or `Order` schema.
- All three custom keywords MUST live inside a single `scope({...})` call and be referenced by their bare alias name from the `Order` schema (do NOT define them as standalone `type(...)` values and stitch them together afterwards).
- The Luhn check for `creditCard` MUST be implemented as a narrow predicate (custom validation logic), not as a regex literal. The digit count constraint can be expressed structurally; only the checksum needs to be in user code.
- For `usPhone`, use ArkType's regex constraint mechanism with the exact pattern shown above.
- For `slug`, the lowercase + length + no-leading/trailing-dash rule may be expressed using any combination of ArkType length constraints, regex constraints, and narrow predicates. The empty string and strings shorter than 3 characters must be rejected.
- The CLI entry point MUST be named `cli.ts`. It must call the schema's assertion API (or equivalent) and convert thrown ArkType errors into the `INVALID: ...` line. Unexpected JSON parse errors should also surface as `INVALID: ...`.
- The project ships with `arktype@2.2.0`, `tsx`, and a `tsconfig.json` configured for NodeNext. Run TypeScript files directly via `npx tsx`.

