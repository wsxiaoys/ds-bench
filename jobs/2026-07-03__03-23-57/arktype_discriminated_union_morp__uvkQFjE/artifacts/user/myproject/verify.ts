import { type } from "arktype"
import { PayloadSchema } from "./src/schema.js"

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error("Assertion failed:", message)
    process.exit(1)
  }
}

console.log("Running PayloadSchema verification...")

// 1. PayloadSchema({ kind: "int", value: "42" }) returns { kind: "int", value: 42 } (number 42, NOT a string)
const res1 = PayloadSchema({ kind: "int", value: "42" })
assert(!(res1 instanceof type.errors), "res1 should not be an error")
assert(res1.kind === "int", "res1.kind should be 'int'")
assert(res1.value === 42, "res1.value should be morphed to the number 42")
console.log("Check 1 passed (kind: 'int', value: '42' -> morphed to number 42)")

// 2. PayloadSchema({ kind: "raw", value: "42" }) returns { kind: "raw", value: "42" } (string "42" preserved)
const res2 = PayloadSchema({ kind: "raw", value: "42" })
assert(!(res2 instanceof type.errors), "res2 should not be an error")
assert(res2.kind === "raw", "res2.kind should be 'raw'")
assert(res2.value === "42", "res2.value should preserve string '42'")
console.log("Check 2 passed (kind: 'raw', value: '42' -> preserved string '42')")

// 3. PayloadSchema({ kind: "other", value: "42" }) must be rejected (returning an arktype errors instance, i.e., instanceof type.errors is true)
const res3 = PayloadSchema({ kind: "other", value: "42" })
assert(res3 instanceof type.errors, "res3 should be an errors instance")
console.log("Check 3 passed (kind: 'other', value: '42' rejected successfully)")

// 4. Invalid numeric string for int branch must be rejected
const res4 = PayloadSchema({ kind: "int", value: "abc" })
assert(res4 instanceof type.errors, "res4 should be an errors instance because 'abc' is not a numeric string")
console.log("Check 4 passed (invalid numeric string for 'int' branch rejected successfully)")

console.log("All PayloadSchema verification checks passed successfully!")
