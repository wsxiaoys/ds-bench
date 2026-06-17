import { type } from "arktype";

/**
 * A discriminated-union schema for a typed payload.
 *
 * Branch "int":  `value` is morphed from a numeric string → number at parse time.
 * Branch "raw":  `value` is kept as a plain string.
 *
 * The `kind` literal field is the discriminator that lets ArkType resolve
 * which morph to apply without ambiguity.
 *
 * Usage:
 *   PayloadSchema({ kind: "int", value: "42" })  // → { kind: "int", value: 42 }
 *   PayloadSchema({ kind: "raw", value: "42" })  // → { kind: "raw", value: "42" }
 *   PayloadSchema({ kind: "other", value: "42" }) // → ArkErrors instance
 */
export const PayloadSchema = type(
  // Branch 1 – integer branch: value is morphed from a numeric string to a number
  { kind: '"int"', value: "string.integer.parse" },
  "|",
  // Branch 2 – raw branch: value stays as the original string
  { kind: '"raw"', value: "string" },
);
