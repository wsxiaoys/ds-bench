import { type } from "arktype"
import { exportJsonSchema, roundTrip } from "./roundTrip.ts"

interface Input {
  schema: unknown
  corpus: unknown[]
}

interface Agreement {
  index: number
  originalAccept: boolean
  roundTrippedAccept: boolean
  agree: boolean
}

interface Output {
  jsonSchema: object
  agreements: Agreement[]
  allAgree: boolean
}

async function main(): Promise<void> {
  // Read all of stdin
  const chunks: Buffer[] = []
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.from(chunk))
  }
  const raw = Buffer.concat(chunks).toString("utf-8")

  let input: Input
  try {
    input = JSON.parse(raw)
  } catch {
    process.stderr.write("Invalid JSON input on stdin\n")
    process.exit(1)
  }

  if (input.schema === undefined || !Array.isArray(input.corpus)) {
    process.stderr.write('Input must have shape { "schema": ..., "corpus": [...] }\n')
    process.exit(1)
  }

  // Build the original Type from the definition
  const original = type.raw(input.schema)

  // Obtain the intermediate JSON Schema document
  const jsonSchema = exportJsonSchema(original)

  // Round-trip: re-parse the JSON Schema back into an ArkType Type
  const roundTripped = roundTrip(original)

  // For each payload in the corpus, check agreement using .allows()
  // (Using .allows() avoids issues with ArkErrors from different arktype versions)
  const agreements: Agreement[] = []
  let allAgree = true

  for (let i = 0; i < input.corpus.length; i++) {
    const payload = input.corpus[i]

    const originalAccept = original.allows(payload)
    const roundTrippedAccept = roundTripped.allows(payload)
    const agree = originalAccept === roundTrippedAccept

    if (!agree) {
      allAgree = false
    }

    agreements.push({
      index: i,
      originalAccept,
      roundTrippedAccept,
      agree,
    })
  }

  const output: Output = {
    jsonSchema,
    agreements,
    allAgree,
  }

  process.stdout.write(JSON.stringify(output) + "\n")

  if (!allAgree) {
    process.exit(1)
  }
}

main().catch((err) => {
  process.stderr.write(String(err) + "\n")
  process.exit(1)
})
