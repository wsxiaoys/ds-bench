import { Buffer } from "node:buffer"
import { type } from "arktype"
import { exportJsonSchema, roundTrip } from "./roundTrip.js"

async function main() {
  const chunks: Buffer[] = []
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.from(chunk))
  }
  const inputString = Buffer.concat(chunks).toString("utf-8")
  
  if (!inputString.trim()) {
    process.exit(1)
  }

  const input = JSON.parse(inputString)
  const schemaDef = input.schema
  const corpus = input.corpus

  const originalType = type(schemaDef)
  const jsonSchema = exportJsonSchema(originalType)
  const roundTrippedType = roundTrip(originalType)

  const agreements = []
  let allAgree = true

  for (let i = 0; i < corpus.length; i++) {
    const payload = corpus[i]
    const originalAccept = originalType.allows(payload)
    const roundTrippedAccept = roundTrippedType.allows(payload)
    const agree = originalAccept === roundTrippedAccept

    if (!agree) {
      allAgree = false
    }

    agreements.push({
      index: i,
      originalAccept,
      roundTrippedAccept,
      agree
    })
  }

  const output = {
    jsonSchema,
    agreements,
    allAgree
  }

  console.log(JSON.stringify(output, null, 2))

  if (!allAgree) {
    process.exit(1)
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
