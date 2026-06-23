import { type } from "arktype"

const schema = type({
    username: "string >= 3 <= 20"
})

const result = schema({ username: "ab" })
console.log(result.errors ? result.errors.byPath : result.byPath)
console.log(Object.keys(result))
