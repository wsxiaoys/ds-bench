import { type } from "arktype"

const schema = type({
    a: "string",
    b: "string"
}).narrow((data, ctx) => {
    if (data.a !== data.b) {
        ctx.reject({ expected: "equal to a", actual: data.b, path: ["b"] })
        return false
    }
    return true
})

const res = schema({ a: "a", b: "b" })
console.log(JSON.stringify(res.byPath))
