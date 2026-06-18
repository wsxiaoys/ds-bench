import { type } from "arktype"

/**
 * broken.ts — intentionally constructs an *ambiguous* union that
 * ArkType refuses to parse.
 *
 * Both branches accept the same shape { value: string } but apply
 * different morphs to `value`.  Without a discriminator field,
 * ArkType cannot decide which morph to run and throws a ParseError.
 *
 * Expected: process exits non-zero with "ParseError" in output.
 */

// This definition lacks a discriminator, so the union is ambiguous.
// ArkType will throw ParseError at definition time.
const BrokenSchema = type.or(
  { value: type("string", "=>", (s) => Number(s)) },
  { value: "string" }
)

// If we somehow got here (we won't), exercise the schema so the
// process at least does something observable.
console.log(BrokenSchema)