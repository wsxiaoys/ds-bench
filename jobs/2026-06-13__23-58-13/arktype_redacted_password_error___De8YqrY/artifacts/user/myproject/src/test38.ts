import { type } from "arktype"
const ssnType = type(/^\\d{3}-\\d{2}-\\d{4}$/)
const result = ssnType("123")
if (result instanceof type.errors) {
    const errorObj = Object.assign({}, result, { byPath: result.byPath });
    console.log(JSON.stringify(errorObj))
}
