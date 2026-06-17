import { type } from "arktype"
type("string").narrow((s, ctx) => {
    // @ts-expect-error
    ctx.mustBe("abc", { actual: "<redacted>" })
    return true
})
