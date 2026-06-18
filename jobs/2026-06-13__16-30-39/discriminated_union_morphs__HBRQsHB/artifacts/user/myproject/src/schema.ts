import { type } from "arktype"

/**
 * PayloadSchema: a discriminated union of two object branches.
 *
 * - Branch "int": morphs `value` from a numeric string into a `number`.
 * - Branch "raw": keeps `value` as a `string`.
 *
 * The `kind` literal field acts as the discriminator so ArkType can
 * unambiguously select the correct branch (and its morph) at runtime.
 */
export const PayloadSchema = type.or(
  { kind: '"int"', value: type("string", "=>", (s) => Number(s)) },
  { kind: '"raw"', value: "string" }
)