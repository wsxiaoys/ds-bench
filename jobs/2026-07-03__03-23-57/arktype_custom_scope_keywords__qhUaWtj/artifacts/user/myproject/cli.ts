import * as fs from "fs"
import { Order } from "./src/keywords.js"

function main() {
  let input = ""
  try {
    input = fs.readFileSync(0, "utf-8")
  } catch (err: any) {
    console.log(`INVALID: Failed to read from stdin: ${err.message}`)
    process.exit(0)
  }

  let payload: any
  try {
    payload = JSON.parse(input)
  } catch (err: any) {
    console.log(`INVALID: Invalid JSON: ${err.message}`)
    process.exit(0)
  }

  try {
    const validated = Order.assert(payload)
    console.log("VALID")
    console.log(JSON.stringify(validated))
  } catch (err: any) {
    // Replace newlines or bullet points with a cleaner format if ArkType produces multi-line errors
    // Wait, let's keep the error message as-is or clean it up.
    // The requirement says: "On failure it prints a single line beginning with `INVALID: ` followed by a short error description."
    // Let's make sure it is a SINGLE line. If err.message has newlines, we can replace them with spaces or commas, or just use the first line.
    // Let's replace newlines with spaces or semicolons, or just clean it up so it is guaranteed to be a single line.
    const cleanMessage = err.message ? err.message.replace(/\s+/g, " ").trim() : String(err)
    console.log(`INVALID: ${cleanMessage}`)
  }
}

main()
