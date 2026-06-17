import { attest } from "@arktype/attest"
import { type } from "arktype"
import { describe, it } from "vitest"

describe("ArkType attest test suite", () => {
  it("asserts compile-time inferred type of string.numeric.parse", () => {
    const numeric = type("string.numeric.parse")
    attest<number>(numeric.infer)
  })

  it("asserts runtime and type errors of type('number%0')", () => {
    // @ts-expect-error
    attest(() => type("number%0")).throwsAndHasTypeError(
      "% operator must be followed by a non-zero integer literal (was 0)"
    )
  })
})
