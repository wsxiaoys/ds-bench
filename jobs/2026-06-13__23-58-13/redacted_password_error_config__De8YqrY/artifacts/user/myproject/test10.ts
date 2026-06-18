import { type } from "arktype"

const passwordType = type("string >= 12 <= 128").narrow((s, ctx) => {
    if (!/[a-z]/.test(s)) return ctx.mustBe("a password containing at least one lowercase letter")
    if (!/[A-Z]/.test(s)) return ctx.mustBe("a password containing at least one uppercase letter")
    if (!/\d/.test(s)) return ctx.mustBe("a password containing at least one digit")
    if (!/[^a-zA-Z0-9]/.test(s)) return ctx.mustBe("a password containing at least one symbol")
    return true
}).configure({
    actual: () => "<redacted>"
})

const schema = type({
    username: "string.alphanumeric >= 3 <= 20",
    password: passwordType,
    confirm: passwordType,
}).narrow((data, ctx) => {
    if (data.password !== data.confirm) {
        ctx.mustBe("equal to password", { path: ["confirm"] })
        return false
    }
    return true
})

const res = schema({ username: "abc", password: "Password123!", confirm: "Password123?" })
console.log(JSON.stringify(res.byPath))
