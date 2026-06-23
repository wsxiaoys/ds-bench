import { type } from "arktype"
const res = type("string").narrow((s, ctx) => {
    return ctx.mustBe("something")
}).configure({
    actual: () => "<redacted>"
})("a")
console.log(JSON.stringify(res.byPath))
