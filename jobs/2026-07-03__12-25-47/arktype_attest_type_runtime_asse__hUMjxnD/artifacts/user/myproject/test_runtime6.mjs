import { type } from "arktype"

const StringNumeric = type("string.numeric.parse")
console.log("infer type:", typeof StringNumeric.infer)
console.log("Has infer prop:", "infer" in StringNumeric)
console.log("infer descriptor:", Object.getOwnPropertyDescriptor(StringNumeric, "infer"))
console.log("inferOut descriptor:", Object.getOwnPropertyDescriptor(StringNumeric, "inferOut"))
