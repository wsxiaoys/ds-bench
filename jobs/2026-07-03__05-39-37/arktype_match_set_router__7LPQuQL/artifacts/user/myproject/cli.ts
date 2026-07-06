import { route } from "./src/router.js"

/**
 * CLI entry point.
 *
 * Reads a single JSON document of the form `{"events": [...]}` from stdin,
 * iterates through `events` in order, and applies the `route` matcher to
 * each item. Successfully routed events print their routed string on their
 * own stdout line, preserving input order.
 *
 * The first time `route` throws (because of the `"assert"` default), the CLI
 * prints one final line of the form `ERR <message>` to stdout and stops
 * processing the remaining events. The process always exits with status 0.
 */
async function readStdin(): Promise<string> {
  const chunks: Buffer[] = []
  for await (const chunk of process.stdin) {
    chunks.push(chunk as Buffer)
  }
  return Buffer.concat(chunks).toString("utf8")
}

async function main(): Promise<void> {
  const raw = await readStdin()

  let events: unknown[] = []
  try {
    const parsed = JSON.parse(raw) as { events?: unknown[] }
    if (Array.isArray(parsed?.events)) {
      events = parsed.events
    }
  } catch {
    // Invalid JSON: nothing to route.
    events = []
  }

  for (const event of events) {
    try {
      const result = route(event)
      console.log(result)
    } catch (err) {
      console.log(`ERR ${(err as Error).message}`)
      break
    }
  }

  process.exit(0)
}

void main()