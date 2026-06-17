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
    username: "string.alphanumeric >= 3 <= 20",
    password: passwordType,
    confirm: confirmType,
    ssn: type(/^\\d{3}-\\d{2}-\\d{4}$/).configure({
        actual: () => "<redacted>",
        problem: (ctx) => `${ctx.expected} (actual: <redacted>)`
    })
})

const res = schema({ username: "a!", password: "123", confirm: "123", ssn: "123" })
if (res instanceof type.errors) {
    for (const err of res) {
        if (err.path.length > 0 && ["password", "confirm", "ssn"].includes(String(err.path[0]))) {
            (err as any).data = "<redacted>";
        }
    }
    console.log(JSON.stringify(Object.assign({ byPath: res.byPath }, res)))
}
