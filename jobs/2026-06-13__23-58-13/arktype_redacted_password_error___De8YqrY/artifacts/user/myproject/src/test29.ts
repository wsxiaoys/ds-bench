import { type } from "arktype"

const passwordType = type("string").narrow((s, ctx) => {
    let isValid = true;
    if (s.length < 12) { ctx.reject({ expected: "at least length 12", actual: "<redacted>" }); isValid = false; }
    else if (s.length > 128) { ctx.reject({ expected: "at most length 128", actual: "<redacted>" }); isValid = false; }
    if (!/[a-z]/.test(s)) { ctx.reject({ expected: "at least one lowercase letter", actual: "<redacted>" }); isValid = false; }
    if (!/[A-Z]/.test(s)) { ctx.reject({ expected: "at least one uppercase letter", actual: "<redacted>" }); isValid = false; }
    if (!/\d/.test(s)) { ctx.reject({ expected: "at least one digit", actual: "<redacted>" }); isValid = false; }
    if (!/[^a-zA-Z0-9]/.test(s)) { ctx.reject({ expected: "at least one symbol", actual: "<redacted>" }); isValid = false; }
    return isValid;
}).configure({
    actual: () => "<redacted>",
    problem: (ctx) => `${ctx.expected} (actual: <redacted>)`
})

const res = passwordType("abc")
console.log(JSON.stringify(res.byPath))
