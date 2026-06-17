import { type } from "arktype"
import { exportJsonSchema, roundTrip } from "./roundTrip.js"

const testCases = [
  {
    name: "simple string",
    schema: "string",
    corpus: ["hello", "", 123, null, {}],
  },
  {
    name: "simple number",
    schema: "number",
    corpus: [123, 0, -1.5, "123", null],
  },
  {
    name: "boolean",
    schema: "boolean",
    corpus: [true, false, "true", 0, null],
  },
  {
    name: "null",
    schema: "null",
    corpus: [null, undefined, 0, ""],
  },
  {
    name: "string.email",
    schema: "string.email",
    corpus: ["test@example.com", "a@b.co", "not-an-email", "", 123],
  },
  {
    name: "number.integer",
    schema: "number.integer",
    corpus: [123, 0, -5, 12.34, "123"],
  },
  {
    name: "nested object with optional properties",
    schema: {
      name: "string",
      "age?": "number",
    },
    corpus: [
      { name: "Alice", age: 30 },
      { name: "Bob" },
      { age: 30 },
      { name: "Alice", age: "30" },
      {},
    ],
  },
  {
    name: "array of strings",
    schema: "string[]",
    corpus: [["a", "b"], [], ["a", 123], "not-an-array"],
  },
  {
    name: "union of literals",
    schema: "'yes' | 'no' | 'maybe'",
    corpus: ["yes", "no", "maybe", "other", 123, null],
  },
]

let totalPassed = 0
let totalFailed = 0

for (const tc of testCases) {
  try {
    const originalType = type(tc.schema as any)
    const jsonSchema = exportJsonSchema(originalType)
    const roundTrippedType = roundTrip(originalType)

    let allAgree = true
    const results = []

    for (const payload of tc.corpus) {
      const originalAccept = originalType.allows(payload)
      const roundTrippedAccept = roundTrippedType.allows(payload)
      const agree = originalAccept === roundTrippedAccept
      if (!agree) {
        allAgree = false
      }
      results.push({ payload, originalAccept, roundTrippedAccept, agree })
    }

    if (allAgree) {
      console.log(`✅ Passed: ${tc.name}`)
      totalPassed++
    } else {
      console.error(`❌ Failed: ${tc.name}`)
      console.error("Schema:", tc.schema)
      console.error("JSON Schema:", JSON.stringify(jsonSchema, null, 2))
      console.error("Results:", results)
      totalFailed++
    }
  } catch (err) {
    console.error(`💥 Error in test case: ${tc.name}`, err)
    totalFailed++
  }
}

console.log(`\nSummary: ${totalPassed} passed, ${totalFailed} failed.`)
if (totalFailed > 0) {
  process.exit(1)
} else {
  process.exit(0)
}
