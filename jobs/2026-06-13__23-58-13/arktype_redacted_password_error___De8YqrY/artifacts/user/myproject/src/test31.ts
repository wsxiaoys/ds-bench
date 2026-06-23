import { type } from "arktype"
const passwordType = type("string >= 12 <= 128")
    .matching(/[a-z]/)
    .matching(/[A-Z]/)
    .matching(/\d/)
    .matching(/[^a-zA-Z0-9]/)
    .configure({
        intersection: {
            actual: () => "<redacted>",
            problem: (ctx) => `${ctx.expected} (actual: <redacted>)`
        },
        actual: () => "<redacted>",
        problem: (ctx) => `${ctx.expected} (actual: <redacted>)`
    } as any)

const res = passwordType("abc")
console.log(JSON.stringify(res.byPath))
