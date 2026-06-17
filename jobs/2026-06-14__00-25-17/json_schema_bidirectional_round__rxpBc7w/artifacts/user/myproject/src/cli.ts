import { type } from "arktype"
import { roundTrip, exportJsonSchema } from "./roundTrip.js"

function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = ""
    process.stdin.setEncoding("utf8")
    process.stdin.on("data", (chunk: string) => {
      data += chunk
    })
    process.stdin.on("end", () => resolve(data))
    process.stdin.on("error", reject)
  })
}

/**
 * Check if a validation result is an ArkErrors instance (validation failure).
 * Uses duck-typing to work across different arktype package instances.
 */
function isArkErrors(result: unknown): boolean {
  return (
    typeof result === "object" &&
    result !== null &&
    "count" in result &&
    "byPath" in result
  )
}

async function main() {
  const input = await readStdin()
  const { schema: schemaDef, corpus } = JSON.parse(input)

  // Build the original ArkType Type from the definition
  const originalType = type(schemaDef)

  // Export to JSON Schema and round-trip back
  const jsonSchema = exportJsonSchema(originalType)
  const roundTrippedType = roundTrip(originalType)

  // Compare original and round-tripped against the corpus
  const agreements = corpus.map((payload: unknown, index: number) => {
    const originalResult = originalType(payload)
    const roundTrippedResult = roundTrippedType(payload)

    const originalAccept = !isArkErrors(originalResult)
    const roundTrippedAccept = !isArkErrors(roundTrippedResult)
    const agree = originalAccept === roundTrippedAccept

    return { index, originalAccept, roundTrippedAccept, agree }
  })

  const allAgree = agreements.every((a: { agree: boolean }) => a.agree)

  const output = {
    jsonSchema,
    agreements,
    allAgree,
  }

  process.stdout.write(JSON.stringify(output))
  process.exit(allAgree ? 0 : 1)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})