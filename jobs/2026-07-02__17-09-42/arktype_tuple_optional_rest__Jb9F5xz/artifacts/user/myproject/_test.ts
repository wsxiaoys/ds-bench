import { type } from "arktype"

// Look at how array length bounds work
const t1 = type("string[]")
console.log("t1 expr:", t1.expression)
const t2 = type("string >= 5")
console.log("t2 expr:", t2.expression)
// We can use a constraint on string length
const t3 = type("/^.{0,30}$/ & string")
console.log("t3 expr:", t3.expression)
console.log("t3 'abc':", t3("abc"))
console.log("t3 'a'.repeat(31):", t3("a".repeat(31)) instanceof type.errors ? "err" : "ok")
console.log("t3 '':", t3("") instanceof type.errors ? "err" : "ok")
