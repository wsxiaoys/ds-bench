import { type } from "arktype"

const passwordType = type("string").narrow((s, ctx) => {
    if (s.length < 12 || s.length > 128) { ctx.reject({ expected: "between 12 and 128 characters", actual: "<redacted>" }); return false; }
    if (!/[a-z]/.test(s)) { ctx.reject({ expected: "at least one lowercase letter", actual: "<redacted>" }); return false; }
    if (!/[A-Z]/.test(s)) { ctx.reject({ expected: "at least one uppercase letter", actual: "<redacted>" }); return false; }
    if (!/\d/.test(s)) { ctx.reject({ expected: "at least one digit", actual: "<redacted>" }); return false; }
    if (!/[^a-zA-Z0-9]/.test(s)) { ctx.reject({ expected: "at least one symbol", actual: "<redacted>" }); return false; }
    return true
}).configure({
    actual: () => "<redacted>",
    problem: (ctx) => `${ctx.expected} (actual: <redacted>)`
})

const confirmType = passwordType.narrow((s, ctx) => {
    if (s !== (ctx.root as any).password) {
        ctx.reject({ expected: "equal to password", actual: "<redacted>" })
        return false
    }
    return true
}).configure({
    actual: () => "<redacted>",
    problem: (ctx) => `${ctx.expected} (actual: <redacted>)`
})

const schema = type({
    password: passwordType,
    confirm: confirmType
})

const res = schema({ password: "Password123!", confirm: "Password123?" })
console.log(JSON.stringify(res.byPath))
