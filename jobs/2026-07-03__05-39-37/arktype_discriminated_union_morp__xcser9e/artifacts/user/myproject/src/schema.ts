import { type } from "arktype";

/**
 * PayloadSchema — a discriminated union of two object branches that morph the
 * same `value` field in different ways.
 *
 * The `kind` field is a literal string discriminator:
 *   • "int"  → `value` is morphed from a numeric string into a `number`
 *   • "raw"  → `value` stays as a `string`
 *
 * Because the two branches are disjoint on the `kind` literal, ArkType is able
 * to deterministically pick a branch *before* applying any morph, so it is happy
 * to compose morphs that would otherwise conflict.
 */
export const PayloadSchema = type.or(
  // Branch A: parse the numeric string into a real number.
  { kind: "'int'", value: "string.numeric.parse" },
  // Branch B: leave the string untouched.
  { kind: "'raw'", value: "string" }
);

export type Payload = typeof PayloadSchema.t;