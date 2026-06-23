import { type } from "arktype"
const passwordType = type("string").narrow((s, ctx) => {
    if (s.length < 12 || s.length > 128) return ctx.reject({ expected: "a string between 12 and 128 characters", actual: "<redacted>" })
    if (!/[a-z]/.test(s)) return ctx.reject({ expected: "a password containing at least one lowercase letter", actual: "<redacted>" })
    if (!/[A-Z]/.test(s)) return ctx.reject({ expected: "a password containing at least one uppercase letter", actual: "<redacted>" })
    if (!/\d/.test(s)) return ctx.reject({ expected: "a password containing at least one digit", actual: "<redacted>" })
    if (!/[^a-zA-Z0-9]/.test(s)) return ctx.reject({ expected: "a password containing at least one symbol", actual: "<redacted>" })
    return true
}).configure({
    actual: () => "<redacted>",
    problem: (ctx) => `${ctx.expected} (actual: <redacted>)`
})

const res = passwordType("abc")
console.log(JSON.stringify(res.byPath))
