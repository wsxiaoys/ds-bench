import * as fs from "fs"
import { type } from "arktype"
import { exportJsonSchema, roundTrip } from "./roundTrip.js"

function main() {
  try {
    const inputRaw = fs.readFileSync(0, "utf-8")
    if (!inputRaw.trim()) {
      console.error("Input is empty")
      process.exit(1)
    }
    const input = JSON.parse(inputRaw)

    const { schema: schemaDef, corpus } = input
    if (schemaDef === undefined || !Array.isArray(corpus)) {
      console.error("Invalid input format. Must be { schema: ..., corpus: [...] }")
      process.exit(1)
    }

    const originalType = type(schemaDef)
    const jsonSchema = exportJsonSchema(originalType)
    const roundTrippedType = roundTrip(originalType)

    const agreements = corpus.map((payload: any, index: number) => {
      const originalAccept = originalType.allows(payload)
      const roundTrippedAccept = roundTrippedType.allows(payload)
      const agree = originalAccept === roundTrippedAccept
      return {
        index,
        originalAccept,
        roundTrippedAccept,
        agree,
      }
    })

    const allAgree = agreements.every((a) => a.agree)

    const output = {
      jsonSchema,
      agreements,
      allAgree,
    }

    console.log(JSON.stringify(output, null, 2))
    process.exit(allAgree ? 0 : 1)
  } catch (err: any) {
    console.error("Error running check:", err)
    process.exit(1)
  }
}

main()
