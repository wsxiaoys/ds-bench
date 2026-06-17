import { type as typeParser } from "arktype"
import { exportJsonSchema, roundTrip } from "./roundTrip.ts"

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

async function main(): Promise<void> {
  const stdin = await readStdin()
  const input = JSON.parse(stdin)
  const { schema: schemaDef, corpus } = input

  // Build original type from the ArkType definition
  const originalType = typeParser(schemaDef)

  // Round-trip through JSON Schema
  const roundTrippedType = roundTrip(originalType)
  const jsonSchema = exportJsonSchema(originalType)

  // Check each payload in the corpus using allows() to avoid
  // instanceof issues across different module copies of ArkErrors
  const agreements = corpus.map((payload: unknown, index: number) => {
    const originalAccept = originalType.allows(payload)
    const roundTrippedAccept = roundTrippedType.allows(payload)
    return {
      index,
      originalAccept,
      roundTrippedAccept,
      agree: originalAccept === roundTrippedAccept
    }
  })

  const allAgree = agreements.every((a: { agree: boolean }) => a.agree)

  const result = {
    jsonSchema,
    agreements,
    allAgree
  }

  console.log(JSON.stringify(result))
  process.exit(allAgree ? 0 : 0)
}

main()