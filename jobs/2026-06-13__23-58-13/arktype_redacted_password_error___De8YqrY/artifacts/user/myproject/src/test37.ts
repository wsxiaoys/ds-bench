import { type } from "arktype"
const ssnType = type(/^\\d{3}-\\d{2}-\\d{4}$/).configure({
    actual: () => "<redacted>",
    problem: (ctx) => `${ctx.expected} (actual: <redacted>)`
})

const res = ssnType("123")
console.log(JSON.stringify(res.byPath))
