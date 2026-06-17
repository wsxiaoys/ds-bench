/**
 * broken.ts – intentional ArkType ParseError demonstration
 *
 * This file constructs a union of two branches that BOTH accept overlapping
 * string input for the `value` field, but morph it differently:
 *
 *   - Left branch:  { value: string }           → keeps value as string
 *   - Right branch: { value: string.integer.parse } → coerces value to number
 *
 * Because there is no discriminator field (e.g. `kind`), ArkType cannot
 * statically determine which morph to apply when a value matches both
 * branches. It therefore throws:
 *
 *   ParseError: An unordered union of a type including a morph and a type
 *   with overlapping input is indeterminate
 *
 * The error propagates uncaught so the process exits with a non-zero code.
 */
import { type } from "arktype";

// Constructing this union throws a ParseError at schema-definition time.
// No try/catch – we let it propagate so the process exits non-zero.
const AmbiguousSchema = type(
  // Branch A – plain string: every string is accepted, value left unchanged
  { value: "string" },
  "|",
  // Branch B – integer morph: a numeric string is coerced to a number
  //   → overlaps with Branch A for numeric strings such as "42"
  { value: "string.integer.parse" },
);

// This line is never reached; the line above already throws.
console.log(AmbiguousSchema);
