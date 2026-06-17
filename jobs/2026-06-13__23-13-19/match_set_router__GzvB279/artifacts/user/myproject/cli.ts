import * as fs from "fs"
import { route } from "./src/router.js"

function main() {
  try {
    const input = fs.readFileSync(0, "utf-8")
    if (!input.trim()) {
      return
    }
    const data = JSON.parse(input)
    const events = data.events
    if (!Array.isArray(events)) {
      console.log("ERR Input events is not an array")
      return
    }

    for (const event of events) {
      try {
        const result = route(event)
        console.log(result)
      } catch (err: any) {
        console.log(`ERR ${err.message || err}`)
        break
      }
    }
  } catch (err: any) {
    console.log(`ERR Malformed JSON or input error: ${err.message || err}`)
  }
}

main()
