#!/usr/bin/env tsx
import { validateDiscount } from "./src/validator.ts"

/**
 * CLI entrypoint for validating a single `Discount` JSON payload.
 *
 * Usage:
 *   echo '{"percent":25,"amount":99.99,"validityDays":30,"appliesTo":"cart"}' | npx tsx cli.ts
 *
 * Output:
 *   - On success: prints exactly `VALID` on the first line, followed by the
 *     JSON-stringified validated object on the next line.
 *   - On failure: prints exactly one line starting with `INVALID:` followed by
 *     a space and an error description.
 *
 * The process exits with code 0 for both valid and invalid inputs.
 */

function readStdin(): Promise<string> {
  return new Promise((resolve) => {
    let data = ""
    process.stdin.setEncoding("utf8")
    process.stdin.on("data", (chunk) => {
      data += chunk
    })
    process.stdin.on("end", () => {
      resolve(data)
    })
  })
}

async function main(): Promise<void> {
  const raw = await readStdin()

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch (e) {
    console.log(`INVALID: ${e instanceof Error ? e.message : "invalid JSON input"}`)
    return
  }

  const result = validateDiscount(parsed)

  if (result.valid) {
    console.log("VALID")
    console.log(JSON.stringify(result.data))
  } else {
    console.log(`INVALID: ${result.error}`)
  }
}

main()