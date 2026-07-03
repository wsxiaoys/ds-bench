import * as fs from "node:fs"
import { match } from "arktype"

try {
  const input = fs.readFileSync(0, "utf-8").trim()
  if (!input) {
    throw new Error("Empty input")
  }
  const payload = JSON.parse(input)

  const formatResponse = match({})
    .case({ status: "'success'", data: "object" }, (v) => {
      return "OK:" + JSON.stringify(v.data)
    })
    .case({ status: "'error'", code: "number", reason: "string" }, (v) => {
      return `ERR ${v.code} ${v.reason}`
    })
    .case({ status: "'pending'" }, () => {
      return "PENDING"
    })
    .default("assert")

  const result = formatResponse(payload)
  process.stdout.write(result + "\n")
} catch (error) {
  console.error(error)
  process.exit(1)
}
