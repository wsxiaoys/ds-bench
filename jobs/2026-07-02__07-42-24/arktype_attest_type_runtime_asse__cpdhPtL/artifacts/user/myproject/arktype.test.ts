import { type } from "arktype"
import { attest } from "@arktype/attest"
import { describe, test } from "vitest"

describe("ArkType attest test suite", () => {
  test("string.numeric.parse inferred output", () => {
    const numeric = type("string.numeric.parse")
    
    // Assert that the inferred output of the schema is of type number
    attest<number>(numeric.infer)
  })

  test("number%0 invalid divisor error", () => {
    // @ts-expect-error
    attest(() => type("number%0")).throwsAndHasTypeError(
      "% operator must be followed by a non-zero integer literal (was 0)"
    )
  })
})
