import { attest } from "@arktype/attest"
import { type } from "arktype"

describe("attest features", () => {
	it("type and value assertions", () => {
		const StringNumeric = type("string.numeric")
		// asserts string.numeric.parse is exactly number
		attest<number>(StringNumeric.parse.infer)
		// make assertions about types and values seamlessly
		attest(StringNumeric.parse.infer).type.toString.snap("number")
	})

	it("error assertions", () => {
		// Check type errors, runtime errors, or both at the same time!
		// @ts-expect-error
		attest(() => type("number%0")).throwsAndHasTypeError(
			"% operator must be followed by a non-zero integer literal (was 0)"
		)
	})
})
