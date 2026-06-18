import { ArkErrors } from "arktype"
import { signUpSchema } from "./src/validator.ts"

const SENSITIVE_PATHS = new Set(["password", "confirm", "ssn"])

/**
 * Build a safe, serializable summary of the ArkErrors, ensuring that any
 * string value that matches one of the sensitive raw values is replaced with
 * "<redacted>".
 *
 * We operate directly on `byPath` and call `.toJSON()` on each error so we
 * get a plain object.  A custom JSON.stringify replacer then scrubs every
 * occurrence of a sensitive raw value from every string in the output.
 */
function serializeErrors(
  errors: ArkErrors,
  sensitiveValues: Set<string>
): string {
  const byPath: Record<string, unknown> = {}
  for (const [pathKey, err] of Object.entries(errors.byPath)) {
    byPath[pathKey] = err.toJSON()
  }

  // Replacer: if a value is a string that exactly equals (or contains) one of
  // the sensitive raw values, replace it with "<redacted>".
  function replacer(_key: string, value: unknown): unknown {
    if (typeof value === "string") {
      for (const sv of sensitiveValues) {
        if (value.includes(sv)) {
          return value.split(sv).join("<redacted>")
        }
      }
    }
    return value
  }

  return JSON.stringify({ byPath }, sensitiveValues.size > 0 ? replacer : undefined)
}

async function main(): Promise<void> {
  // Read all stdin
  const chunks: Buffer[] = []
  for await (const chunk of process.stdin) {
    chunks.push(chunk as Buffer)
  }
  const raw = Buffer.concat(chunks).toString("utf8").trim()

  let payload: unknown
  try {
    payload = JSON.parse(raw)
  } catch {
    process.stdout.write(
      `INVALID: ${JSON.stringify({
        byPath: { "": { message: "Input is not valid JSON" } },
      })}\n`
    )
    process.exit(0)
  }

  // Collect the raw values of sensitive fields so we can scrub them from output
  const sensitiveValues = new Set<string>()
  if (payload !== null && typeof payload === "object" && !Array.isArray(payload)) {
    const p = payload as Record<string, unknown>
    for (const field of SENSITIVE_PATHS) {
      if (typeof p[field] === "string" && p[field] !== "") {
        sensitiveValues.add(p[field] as string)
      }
    }
  }

  const result = signUpSchema(payload)

  if (result instanceof ArkErrors) {
    process.stdout.write(
      `INVALID: ${serializeErrors(result, sensitiveValues)}\n`
    )
    process.exit(0)
  }

  // Validation succeeded
  process.stdout.write(`VALID\n${JSON.stringify(result)}\n`)
  process.exit(0)
}

main()
