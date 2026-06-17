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

/**
 * Check whether a validation result is an ArkErrors instance.
 *
 * Since the round-tripped Type may come from a different arktype module instance
 * (e.g. @ark/json-schema's bundled arktype), we cannot rely on `instanceof type.errors`.
 * Instead we use a duck-typing check: ArkErrors objects have a `count` property
 * (the number of validation errors) and an ` arkKind` property set to `"errors"`.
 */
function isArkErrors(result: unknown): boolean {
  if (result === null || result === undefined) return false
  if (typeof result !== "object") return false
  const r = result as Record<string, unknown>
  return r[" arkKind"] === "errors" || (typeof r.count === "number" && r.count > 0)
}

async function main(): Promise<void> {
  // Read stdin
  const chunks: Buffer[] = []
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.from(chunk))
  }
  const inputJson = Buffer.concat(chunks).toString("utf-8")
  const input: Input = JSON.parse(inputJson)

  // Build the original Type from the definition
  const original = type(input.schema as any)

  // Obtain the JSON Schema and round-tripped Type
  const jsonSchema = exportJsonSchema(original)
  const roundTripped = roundTrip(original)

  // Test each payload in the corpus
  const agreements: Agreement[] = []
  let allAgree = true

  for (let i = 0; i < input.corpus.length; i++) {
    const payload = input.corpus[i]

    // original(payload) returns either the validated data or an ArkErrors instance
    const originalResult = original(payload)
    const originalAccept = !(originalResult instanceof type.errors)

    // roundTripped may be from a different arktype instance, so use duck-typing
    const roundTrippedResult = roundTripped(payload)
    const roundTrippedAccept = !isArkErrors(roundTrippedResult)

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
  console.error(err)
  process.exit(1)
})
