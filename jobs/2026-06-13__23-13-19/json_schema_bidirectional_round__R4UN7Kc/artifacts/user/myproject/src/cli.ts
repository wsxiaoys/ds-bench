import { readFileSync } from "fs"
import { type } from "arktype"
import { roundTrip, exportJsonSchema } from "./roundTrip.js"

function main() {
  try {
    const inputStr = readFileSync(0, "utf-8")
    const input = JSON.parse(inputStr)

    const originalType = type(input.schema)
    const jsonSchema = exportJsonSchema(originalType)
    const roundTrippedType = roundTrip(originalType)

    const agreements = input.corpus.map((payload: any, index: number) => {
      const originalAccept = originalType.allows(payload)
      const roundTrippedAccept = roundTrippedType.allows(payload)
      const agree = originalAccept === roundTrippedAccept
      return {
        index,
        originalAccept,
        roundTrippedAccept,
        agree
      }
    })

    const allAgree = agreements.every((a: any) => a.agree)

    const output = {
      jsonSchema,
      agreements,
      allAgree
    }

    console.log(JSON.stringify(output, null, 2))

    if (allAgree) {
      process.exit(0)
    } else {
      process.exit(1)
    }
  } catch (err) {
    console.error("Error running check cli:", err)
    process.exit(1)
  }
}

main()
