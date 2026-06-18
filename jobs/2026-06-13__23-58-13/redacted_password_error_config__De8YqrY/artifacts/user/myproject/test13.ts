import { type } from "arktype"

const schema = type({
    password: "string",
    confirm: type("string").narrow((s, ctx) => {
        console.log(Object.keys(ctx))
        console.log(ctx.root)
        return true
    })
})

schema({ password: "p", confirm: "c" })
