import { type } from "arktype"

const StringNumeric = type("string.numeric.parse")
console.log("Keys:", Object.keys(StringNumeric))
console.log("All properties:", Object.getOwnPropertyNames(StringNumeric))
console.log("---string numeric---")
const T = type("string.numeric")
console.log("Keys:", Object.keys(T))
console.log("All properties:", Object.getOwnPropertyNames(T))
console.log("t.infer:", T.infer)
console.log("t.t:", T.t)
console.log("---test arktype.attest expectations---")
// The task says: "attest<number>(...) call that succeeds against the inferred output of a string.numeric.parse"
// So I need to make a schema that has inferred type number
// Maybe via pipe or morph
