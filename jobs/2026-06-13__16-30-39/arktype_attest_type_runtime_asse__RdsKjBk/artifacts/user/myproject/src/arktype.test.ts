import { attest } from "@arktype/attest"
import { type } from "arktype"
import { describe, it } from "vitest"

describe("arktype attest", () => {
  it("attests inferred output type of string.numeric.parse as number", () => {
    const numericParser = type("string.numeric.parse")
    attest<number>(numericParser.infer)
  })

  it("throws and has type error for number%0", () => {
    // @ts-expect-error
    attest(() => type("number%0")).throwsAndHasTypeError(
      "% operator must be followed by a non-zero integer literal (was 0)"
    )
  })
})