import { describe, it } from "vitest"
import { type } from "arktype"
import { attest } from "@arktype/attest"

describe("arktype attest", () => {
	it("infers string.numeric.parse as number", () => {
		const NumericString = type("string.numeric.parse")
		attest<number>(NumericString.infer)
	})

	it("rejects number%0 with runtime and type error", () => {
		// @ts-expect-error - number%0 is invalid ArkType syntax
		attest(() => type("number%0")).throwsAndHasTypeError(
			"% operator must be followed by a non-zero integer literal (was 0)"
		)
	})
})