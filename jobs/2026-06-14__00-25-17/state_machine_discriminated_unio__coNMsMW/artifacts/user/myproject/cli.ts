import { ArkErrors, TraversalError } from "arktype"
import { State, transition } from "./src/state-machine.js"

async function main() {
  // Read JSON from stdin
  const chunks: Buffer[] = []
  for await (const chunk of process.stdin) {
    chunks.push(chunk)
  }
  const input = Buffer.concat(chunks).toString("utf-8")

  // Parse JSON
  let parsed: { initial: unknown; events: unknown[] }
  try {
    parsed = JSON.parse(input)
  } catch {
    console.log("INVALID: Invalid JSON")
    process.exit(0)
  }

  // Validate initial state
  const initialState = State(parsed.initial)
  if (initialState instanceof ArkErrors) {
    console.log(`INVALID: ${initialState.summary}`)
    process.exit(0)
  }

  // Replay events
  let currentState = initialState
  const events = parsed.events

  if (!Array.isArray(events)) {
    console.log("INVALID: events must be an array")
    process.exit(0)
  }

  for (const event of events) {
    try {
      currentState = transition(currentState, event)
    } catch (e) {
      if (e instanceof TraversalError) {
        console.log(`INVALID: ${e.arkErrors.summary}`)
      } else if (e instanceof Error) {
        console.log(`INVALID: ${e.message}`)
      } else {
        console.log(`INVALID: ${String(e)}`)
      }
      process.exit(0)
    }
  }

  console.log("VALID")
  console.log(JSON.stringify(currentState))
}

main()