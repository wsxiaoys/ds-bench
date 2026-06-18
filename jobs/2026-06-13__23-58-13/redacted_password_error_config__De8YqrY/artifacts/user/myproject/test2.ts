import { type } from "arktype"

const schema = type({
    username: "string >= 3 <= 20",
    password: type("string >= 12 <= 128").narrow((s, ctx) => {
        if (!/[a-z]/.test(s) || !/[A-Z]/.test(s) || !/\d/.test(s) || !/[^a-zA-Z0-9]/.test(s)) {
            return ctx.mustBe("a valid password")
        }
        return true
    }).configure({
        actual: () => "<redacted>"
    })
})

const result = schema({ username: "ab", password: "123" })
console.log(JSON.stringify(result))
