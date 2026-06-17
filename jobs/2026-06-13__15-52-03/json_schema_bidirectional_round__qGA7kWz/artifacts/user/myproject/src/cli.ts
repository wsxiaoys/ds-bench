// Runtime globals provided by Node.js — suppress TS errors gracefully
declare const process: {
  stdin: AsyncIterable<unknown>
  stdout: { write(s: string): void }
  stderr: { write(s: string): void }
  exit(code: number): never
}
declare const Buffer: {
  concat(chunks: Uint8Array[]): { toString(enc: string): string }
}

import { type } from "arktype"
import { exportJsonSchema, roundTrip } from "./roundTrip.js"

async function main(): Promise<void> {
  // Read all of stdin
  const chunks: Uint8Array[] = []
  for await (const chunk of process.stdin) {
    chunks.push(chunk as Uint8Array)
  }
  const raw = Buffer.concat(chunks).toString("utf-8")

  const input = JSON.parse(raw) as { schema: unknown; corpus: unknown[] }

  // Build the original ArkType Type from the schema definition
  const original = type.raw(input.schema)

  // Export to JSON Schema (with $schema for draft-2020-12)
  const jsonSchema = exportJsonSchema(original)

  // Re-parse from JSON Schema into a round-tripped ArkType Type
  const roundTripped = roundTrip(original)

  // Evaluate each corpus item against both the original and round-tripped types
  const agreements = (input.corpus as unknown[]).map(
    (item: unknown, index: number) => {
      const originalAccept = original.allows(item)
      const roundTrippedAccept = roundTripped.allows(item)
      const agree = originalAccept === roundTrippedAccept
      return { index, originalAccept, roundTrippedAccept, agree }
    }
  )

  const allAgree = agreements.every((a) => a.agree)

  const output = {
    jsonSchema,
    agreements,
    allAgree,
  }

  process.stdout.write(JSON.stringify(output) + "\n")
  process.exit(allAgree ? 0 : 1)
}

main().catch((err: unknown) => {
  process.stderr.write(String(err) + "\n")
  process.exit(1)
})
