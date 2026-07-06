import { attest } from "@arktype/attest"
import { describe, it } from "vitest"
import { type } from "arktype"

describe("arktype attest", () => {
	it("infers number as the output of string.numeric.parse", () => {
		// `string.numeric.parse` is a morph that accepts a well-formed numeric
		// string and converts it to a number via Number.parseFloat.
		// Its inferred output type (Type.infer / Type.inferOut) is therefore `number`.
		const numericParse = type("string.numeric.parse")

		// Compile-time: asserts that the inferred output type of the schema
		// is exactly `number`. Runtime: attest compares the cached type data.
		attest<number>(numericParse.infer)
	})

	it("reports a type error for a zero divisor", () => {
		// `number%0` is invalid because the % operator requires a non-zero
		// integer literal divisor. Both a runtime error and a TypeScript
		// type error are expected, so we use throwsAndHasTypeError.
		// @ts-expect-error
		attest(() => type("number%0")).throwsAndHasTypeError(
			"% operator must be followed by a non-zero integer literal (was 0)"
		)
	})
})