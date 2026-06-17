import { ArkErrors } from "arktype"
import { schema } from "./src/schema.js"

function readStdin(): Promise<string> {
  return new Promise((resolve) => {
    let data = ""
    process.stdin.setEncoding("utf8")
    process.stdin.on("data", (chunk: string) => {
      data += chunk
    })
    process.stdin.on("end", () => resolve(data))
  })
}

async function main() {
  const raw = await readStdin()

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    console.log("INVALID: malformed JSON")
    return
  }

  if (
    parsed === null ||
    typeof parsed !== "object" ||
    !("kind" in parsed) ||
    !("payload" in parsed)
  ) {
    console.log("INVALID: missing 'kind' or 'payload' field")
    return
  }

  const input = parsed as { kind: unknown; payload: unknown }
  const kind = input.kind
  const payload = input.payload

  let validator
  if (kind === "createUser") {
    validator = schema.api.CreateUserRequest
  } else if (kind === "createOrg") {
    validator = schema.api.CreateOrgRequest
  } else {
    console.log(`INVALID: unknown kind '${kind}'`)
    return
  }

  const result = validator(payload)
  if (result instanceof ArkErrors) {
    console.log(`INVALID: ${result.summary}`)
    return
  }

  console.log("VALID")
  console.log(JSON.stringify(result))
}

main()