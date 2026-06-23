import { type } from "arktype"
type("string").narrow((s, ctx) => {
    console.log(Object.keys(ctx))
    return true
})("a")
