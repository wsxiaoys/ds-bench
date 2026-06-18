import { type } from "arktype"

const confirmType = type("string").narrow((s, ctx) => {
    if (s !== "abc") return ctx.mustBe("equal to abc")
    return true
}).configure({
    predicate: {
        actual: () => "<redacted>",
        problem: (ctx) => `${ctx.expected} (actual: <redacted>)`
    }
} as any)

const res = confirmType("def")
console.log(JSON.stringify(res.byPath))
