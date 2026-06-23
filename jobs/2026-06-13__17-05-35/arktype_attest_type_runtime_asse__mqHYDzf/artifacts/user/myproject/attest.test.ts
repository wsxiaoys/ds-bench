import { attest } from "@arktype/attest"
import { type, string } from "arktype"
import { describe, it } from "vitest"

describe("arktype attest test suite", () => {
	it("should assert string.numeric.parse infers number", () => {
		const NumericString = type(string.numeric)
		// @ts-expect-error - .infer is a compile-time-only property
		attest<number>(NumericString.infer)
	})

	it("should throw and have type error for number%0", () => {
		// @ts-expect-error - type("number%0") is intentionally invalid
		attest(() => type("number%0")).throwsAndHasTypeError(
			"% operator must be followed by a non-zero integer literal (was 0)"
		)
	})
})
