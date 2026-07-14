import { attest } from "@arktype/attest"
import { type } from "arktype"
import { describe, it } from "vitest"

describe("arktype @arktype/attest suite", () => {
	it("string.numeric.parse infers number as its output", () => {
		const numeric = type("string.numeric.parse")

		// Asserts that the inferred output type of the schema is exactly `number`.
		// `numeric.infer` is an inference-only property (undefined at runtime) whose
		// static type is the output of the morph, i.e. `number`.
		attest<number>(numeric.infer)
	})

	it("type('number%0') throws at runtime and reports the expected type error", () => {
		// `type("number%0")` is invalid both at compile-time (a TypeScript error is
		// reported on the definition) and at runtime (the constructor throws).
		// @ts-expect-error
		attest(() => type("number%0")).throwsAndHasTypeError(
			"% operator must be followed by a non-zero integer literal (was 0)"
		)
	})
})