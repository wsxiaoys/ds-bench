import { type } from "arktype"
const passwordType = type("string >= 12 <= 128").narrow((s, ctx) => {
    if (!/[a-z]/.test(s)) { ctx.reject({ expected: "at least one lowercase letter", actual: "<redacted>" }); return false; }
    if (!/[A-Z]/.test(s)) { ctx.reject({ expected: "at least one uppercase letter", actual: "<redacted>" }); return false; }
    if (!/\d/.test(s)) { ctx.reject({ expected: "at least one digit", actual: "<redacted>" }); return false; }
    if (!/[^a-zA-Z0-9]/.test(s)) { ctx.reject({ expected: "at least one symbol", actual: "<redacted>" }); return false; }
    return true
}).configure({
    actual: () => "<redacted>",
    problem: (ctx) => `${ctx.expected} (actual: <redacted>)`
})

const res1 = passwordType("short")
const res2 = passwordType("abcdefghijkl")
console.log("res1:", JSON.stringify(res1.byPath))
console.log("res2:", JSON.stringify(res2.byPath))
