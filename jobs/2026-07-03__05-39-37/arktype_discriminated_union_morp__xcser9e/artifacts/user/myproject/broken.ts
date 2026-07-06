import { type } from "arktype";

/**
 * broken.ts — intentionally constructs an *ambiguous* union.
 *
 * Both branches accept an object whose `value` is a numeric string, but they
 * apply different morphs to that same `value` field:
 *
 *   • left  branch morphs `value` from a numeric string → number
 *   • right branch leaves `value` as a string
 *
 * Crucially, there is NO discriminator field to tell the branches apart. For an
 * input like `{ value: "42" }` both branches match, but they would produce
 * different outputs (`42` vs `"42"`). ArkType refuses to guess and throws the
 * well-known `ParseError: A union that could apply different morphs to the same
 * data` at *definition* time.
 *
 * We deliberately let the ParseError propagate so that running
 * `npx tsx broken.ts` exits non-zero and prints `ParseError` to stderr.
 */

// This line throws — nothing below it executes.
const broken = type.or(
  { value: "string.numeric.parse" },
  { value: "string" }
);

// Unreachable, but included to make the "parse" intent explicit.
console.log(broken({ value: "42" }));