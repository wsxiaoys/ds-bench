import { type } from "arktype"
const res = type("string").narrow((s, ctx) => {
    return ctx.mustBe("something")
}).configure({
    predicate: {
        actual: () => "<redacted>"
    }
} as any)("a")
console.log(JSON.stringify(res.byPath))
