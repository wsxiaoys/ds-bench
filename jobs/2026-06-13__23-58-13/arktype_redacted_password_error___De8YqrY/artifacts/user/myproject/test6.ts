import { type } from "arktype"

const schema = type({
    username: "string >= 3 <= 20"
})

const result = schema({ username: "ab" })
console.log(result.summary)
console.log(JSON.stringify({ byPath: result.byPath }))
