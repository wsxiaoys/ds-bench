import { type } from "arktype"
const res = type("string").narrow((s, ctx) => {
    ctx.reject({ expected: "something", actual: "<redacted>" })
    return false
})("a")
console.log(JSON.stringify(res.byPath))
