import { type } from "arktype";

/**
 * PayloadSchema
 *
 * A discriminated union of two object branches:
 *  - { kind: "int", value: string }  -> { kind: "int", value: number }
 *      The `value` field is morphed from a numeric string into a `number`.
 *  - { kind: "raw", value: string }
 *      The `value` field stays as a `string`.
 *
 * The `kind` field acts as the literal discriminator that ArkType uses to
 * deterministically choose a branch when both branches share overlapping
 * structure (they both have `value: string` at the input). Because the
 * discriminator is a literal unit (not a domain like `string`), ArkType can
 * pick a branch without ambiguity and apply its morph safely.
 */
export const PayloadSchema = type({
	kind: "'int'",
	value: "string.numeric.parse"
}).or({
	kind: "'raw'",
	value: "string"
});