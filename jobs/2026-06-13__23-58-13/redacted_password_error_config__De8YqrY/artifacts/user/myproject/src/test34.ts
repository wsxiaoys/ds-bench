import { type } from "arktype"
const passwordType = type("string >= 12 <= 128").narrow((s, ctx) => {
    if (!/[a-z]/.test(s)) return ctx.mustBe("a password containing at least one lowercase letter")
    if (!/[A-Z]/.test(s)) return ctx.mustBe("a password containing at least one uppercase letter")
    if (!/\d/.test(s)) return ctx.mustBe("a password containing at least one digit")
    if (!/[^a-zA-Z0-9]/.test(s)) return ctx.mustBe("a password containing at least one symbol")
    return true
}).configure({
    actual: () => "<redacted>",
    problem: (ctx) => `${ctx.expected} (actual: <redacted>)`
})

const res = passwordType("abcdefghijkl")
console.log(JSON.stringify(res.byPath))
