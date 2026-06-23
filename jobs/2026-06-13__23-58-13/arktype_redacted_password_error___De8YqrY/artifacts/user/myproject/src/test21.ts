import { type } from "arktype"
type("string").narrow((s, ctx) => {
    let proto = Object.getPrototypeOf(ctx)
    console.log(Object.getOwnPropertyNames(proto))
    return true
})("a")
