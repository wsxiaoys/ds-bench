import { scope } from "arktype"
import * as fs from "fs"
import { fileURLToPath } from "url"

// Define the scope with the payload shapes
const myScope = scope({
  successPayload: { status: "'success'", data: "object" },
  errorPayload: { status: "'error'", code: "number", reason: "string" },
  pendingPayload: { status: "'pending'" }
})

const { match } = myScope

/**
 * Handles the API response using ArkType's match API.
 * Discriminates between success, error, and pending payload shapes.
 * 
 * @param input The API response payload
 * @returns Formatted result string
 */
export function handleResponse(input: unknown): string {
  // Use match({...})({...}) syntax and set default: "assert"
  return match({
    successPayload: (val) => `OK: ${JSON.stringify(val.data)}`,
    errorPayload: (val) => `ERR ${val.code} ${val.reason}`,
    pendingPayload: () => "PENDING",
    default: "assert"
  })(input)
}

// Executable entrypoint
if (import.meta.url && process.argv[1] && fileURLToPath(import.meta.url) === fs.realpathSync(process.argv[1])) {
  try {
    const inputStr = fs.readFileSync(0, "utf-8")
    const input = JSON.parse(inputStr)
    const result = handleResponse(input)
    process.stdout.write(result + "\n")
  } catch (err) {
    console.error("Error handling response:", err)
    process.exit(1)
  }
}
