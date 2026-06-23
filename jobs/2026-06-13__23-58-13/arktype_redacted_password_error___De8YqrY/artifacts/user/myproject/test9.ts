import { type } from "arktype"

const schema = type({
    username: "string >= 3 <= 20"
})

const result = schema({ username: "ab" })
console.log(JSON.stringify(result, (key, value) => {
    if (key === 'ctx') return undefined;
    return value;
}))
