import { Order } from "./src/keywords.js"

let data = ""

process.stdin.setEncoding("utf8")
process.stdin.on("data", (chunk: string) => {
  data += chunk
})
process.stdin.on("end", () => {
  try {
    const parsed = JSON.parse(data)
    const result = Order.assert(parsed)
    console.log("VALID")
    console.log(JSON.stringify(result))
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.log(`INVALID: ${message.replace(/\n/g, " ").replace(/\s+/g, " ").trim()}`)
  }
  process.exit(0)
})