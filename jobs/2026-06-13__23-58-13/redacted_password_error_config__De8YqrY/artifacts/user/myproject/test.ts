import { type } from "arktype"

const schema = type({
    username: "string.alphanumeric >= 3 <= 20",
    password: type("string >= 12 <= 128").narrow((s, ctx) => {
        if (!/[a-z]/.test(s) || !/[A-Z]/.test(s) || !/\d/.test(s) || !/[^a-zA-Z0-9]/.test(s)) {
            return ctx.mustBe("a valid password")
        }
        return true
    }).configure({
        message: (ctx) => `must be a valid password (actual: <redacted>)`,
        actual: () => "<redacted>",
        problem: (ctx) => `must be a valid password (actual: <redacted>)`
    })
})

const result = schema({ username: "abc", password: "123" })
if (result instanceof type.errors) {
    console.log(JSON.stringify(result))
} else {
    console.log("valid", result)
}
