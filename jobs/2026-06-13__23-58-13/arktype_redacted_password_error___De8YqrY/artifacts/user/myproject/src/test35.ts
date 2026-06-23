import { type } from "arktype"
const passwordType = type("string >= 12 <= 128").narrow((s, ctx) => {
    if (!/[A-Z]/.test(s)) return ctx.mustBe("a password containing at least one uppercase letter")
    return true
}).configure({
    predicate: {
        actual: () => "<redacted>",
        problem: (ctx) => `${ctx.expected} (actual: <redacted>)`
    },
    actual: () => "<redacted>",
    problem: (ctx) => `${ctx.expected} (actual: <redacted>)`
} as any)

const res = passwordType("abcdefghijkl")
console.log(JSON.stringify(res.byPath))
