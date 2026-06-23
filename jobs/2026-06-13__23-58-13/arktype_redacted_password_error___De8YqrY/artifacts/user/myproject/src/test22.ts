import { type } from "arktype"
type("string").narrow((s, ctx) => {
    ctx.reject({ expected: "something", actual: "<redacted>" })
    return false
})("a")
