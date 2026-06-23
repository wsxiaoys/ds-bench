import { attest } from "@arktype/attest"
import { type } from "arktype"
import { describe, it } from "vitest"

describe("ArkType attest assertions", () => {
	it("attest<number> succeeds for string.numeric.parse inferred output", () => {
		const numericParse = type("string.numeric.parse")
		// string.numeric.parse transforms a string to a number at runtime,
		// so its inferred output type is `number`
		attest<number>(numericParse.infer)
	})

	it("throwsAndHasTypeError matches number%0 divisibility error", () => {
		// @ts-expect-error
		attest(() => type("number%0")).throwsAndHasTypeError(
			"% operator must be followed by a non-zero integer literal (was 0)"
		)
	})
})
