import { type } from "arktype"
import { exportJsonSchema, roundTrip } from "./roundTrip.ts"

// Read all of stdin
async function readStdin(): Promise<string> {
  const chunks: Buffer[] = []
  for await (const chunk of process.stdin) {
    chunks.push(chunk as Buffer)
  }
  return Buffer.concat(chunks).toString("utf8")
}

async function main(): Promise<void> {
  const raw = await readStdin()
  const input = JSON.parse(raw) as { schema: unknown; corpus: unknown[] }

  // Build the original ArkType type from the definition
  const original = type.raw(input.schema)

  // Export to JSON Schema and round-trip back to ArkType
  const jsonSchema = exportJsonSchema(original)
  const roundTripped = roundTrip(original)

  // Evaluate each corpus item against both types
  const agreements = input.corpus.map((payload, index) => {
    const originalAccept = original.allows(payload)
    const roundTrippedAccept = roundTripped.allows(payload)
    const agree = originalAccept === roundTrippedAccept
    return { index, originalAccept, roundTrippedAccept, agree }
  })

  const allAgree = agreements.every(a => a.agree)

  const output = {
    jsonSchema,
    agreements,
    allAgree,
  }

  process.stdout.write(JSON.stringify(output, null, 2) + "\n")
  process.exit(allAgree ? 0 : 1)
}

main().catch(err => {
  process.stderr.write(String(err) + "\n")
  process.exit(1)
})
