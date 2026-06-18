import { type } from "arktype"
const schema = type({
    username: "string.alphanumeric >= 3 <= 20"
})
const res = schema({ username: "a!" })
console.log(JSON.stringify(res.byPath))
