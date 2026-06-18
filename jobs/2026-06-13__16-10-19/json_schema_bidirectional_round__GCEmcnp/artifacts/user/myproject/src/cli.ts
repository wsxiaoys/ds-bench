import { type } from "arktype"
import { roundTrip, exportJsonSchema } from "./roundTrip.js"

// TODO: Implement the `npm run check` CLI.
//
// The CLI MUST:
//   - Read a single JSON document from stdin with shape:
//       { "schema": <ArkType-definition>, "corpus": [<any>, ...] }
//   - Build the original `Type` via `type(<ArkType-definition>)`.
//   - Use the exports of `./roundTrip` to obtain the round-tripped `Type` and
//     the intermediate JSON Schema document.
//   - Write a single JSON document to stdout with shape:
//       {
//         "jsonSchema": <object including "$schema" for draft-2020-12>,
//         "agreements": [
//           { "index": <int>, "originalAccept": <bool>,
//             "roundTrippedAccept": <bool>, "agree": <bool> },
//           ...
//         ],
//         "allAgree": <bool>
//       }
//   - Exit 0 when `allAgree` is true.

async function run() {
  let data = ""
  for await (const chunk of process.stdin) {
    data += chunk
  }
  
  if (!data.trim()) {
    process.exit(1)
  }

  const input = JSON.parse(data)
  const originalSchema = type(input.schema)
  
  const jsonSchema = exportJsonSchema(originalSchema)
  const roundTrippedSchema = roundTrip(originalSchema)
  
  const agreements = input.corpus.map((payload: any, index: number) => {
    const originalAccept = originalSchema.allows(payload)
    const roundTrippedAccept = roundTrippedSchema.allows(payload)
    return {
      index,
      originalAccept,
      roundTrippedAccept,
      agree: originalAccept === roundTrippedAccept
    }
  })
  
  const allAgree = agreements.every((a: any) => a.agree)
  
  const result = {
    jsonSchema,
    agreements,
    allAgree
  }
  
  console.log(JSON.stringify(result, null, 2))
  process.exit(allAgree ? 0 : 1)
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
