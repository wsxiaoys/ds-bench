import { test } from "vitest"
import { attest } from "@arktype/attest"
import { type } from "arktype"

test("attest string.numeric.parse", () => {
    const t = type("string.numeric.parse")
    attest<number>(t.infer)
})

test("throws and has type error", () => {
    // @ts-expect-error
    attest(() => type("number%0")).throwsAndHasTypeError(
        "% operator must be followed by a non-zero integer literal (was 0)"
    )
})