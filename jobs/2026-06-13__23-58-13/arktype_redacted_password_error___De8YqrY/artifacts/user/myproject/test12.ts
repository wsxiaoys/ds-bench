import { type } from "arktype"

const passwordType = type("string >= 12 <= 128").configure({
    actual: () => "<redacted>"
})

const schema = type({
    password: passwordType,
    confirm: passwordType
}).narrow((data, ctx) => {
    if (data.password !== data.confirm) {
        ctx.reject({ expected: "equal to password", actual: data.confirm, path: ["confirm"] })
        return false
    }
    return true
})

const res = schema({ password: "Password123!", confirm: "Password123?" })
console.log(JSON.stringify(res.byPath))
