import { type } from "arktype"
const passwordType = type("string >= 12 <= 128 & /[a-z]/ & /[A-Z]/ & /\\d/ & /[^a-zA-Z0-9]/").configure({
    actual: () => "<redacted>",
    problem: (ctx) => `${ctx.expected} (actual: <redacted>)`
})

const res = passwordType("abc")
console.log(JSON.stringify(res.byPath))
