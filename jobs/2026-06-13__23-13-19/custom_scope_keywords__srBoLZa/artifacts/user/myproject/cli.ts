import * as fs from "fs"
import { Order } from "./src/keywords.js"

function main() {
  let input = ""
  try {
    input = fs.readFileSync(0, "utf-8")
  } catch (e: any) {
    console.log("INVALID: Failed to read from stdin.")
    process.exit(0)
  }

  let parsed: any
  try {
    parsed = JSON.parse(input)
  } catch (e: any) {
    console.log(`INVALID: Invalid JSON: ${e.message}`)
    process.exit(0)
  }

  try {
    const validated = Order.assert(parsed)
    console.log("VALID")
    console.log(JSON.stringify(validated))
  } catch (e: any) {
    console.log(`INVALID: ${e.message}`)
  }
}

main()
