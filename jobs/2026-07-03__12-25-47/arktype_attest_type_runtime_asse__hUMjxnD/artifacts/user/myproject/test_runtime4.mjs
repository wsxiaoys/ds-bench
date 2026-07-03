import { type } from "arktype"

// Check infer type
const StringNumeric = type("string.numeric.parse")
console.log("Has infer:", "infer" in StringNumeric)
console.log("infer:", StringNumeric.infer)
console.log("---root access---")
const T = type("string.numeric")
console.log("T.infer:", T.infer)
console.log("T.infer type:", typeof T.infer)
