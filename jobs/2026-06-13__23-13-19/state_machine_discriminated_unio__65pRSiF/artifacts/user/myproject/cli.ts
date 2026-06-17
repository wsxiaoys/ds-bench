import fs from "node:fs"
import { type, fn } from "arktype"

// 1. Define State schemas
export const Idle = type({
  status: "'idle'"
})

export const Loading = type({
  status: "'loading'",
  startedAt: "number.integer >= 0"
})

export const Success = type({
  status: "'success'",
  data: "unknown",
  fetchedAt: "number.integer >= 0"
})

export const Failure = type({
  status: "'failure'",
  code: "number.integer >= 400 <= 599",
  reason: "string >= 1 <= 200"
})

export const State = type(Idle).or(Loading).or(Success).or(Failure)

export type State = typeof State.infer

// 2. Define Event schemas
export const Start = type({
  type: "'start'",
  at: "number"
})

export const Resolve = type({
  type: "'resolve'",
  data: "unknown",
  at: "number"
})

export const Reject = type({
  type: "'reject'",
  code: "number.integer",
  reason: "string",
  at: "number"
})

export const Reset = type({
  type: "'reset'"
})

export const Event = type(Start).or(Resolve).or(Reject).or(Reset)

export type Event = typeof Event.infer

// 3. Define Input Document schema
export const InputDocument = type({
  initial: State,
  events: Event.array()
})

export type InputDocument = typeof InputDocument.infer

// 4. Implement the validated transition function
export const transition = fn(State, Event, ":", State)((state, event) => {
  if (event.type === "reset") {
    return { status: "idle" }
  }

  if (state.status === "idle" && event.type === "start") {
    return {
      status: "loading",
      startedAt: Math.trunc(event.at)
    }
  }

  if (state.status === "loading" && event.type === "resolve") {
    return {
      status: "success",
      data: event.data,
      fetchedAt: Math.trunc(event.at)
    }
  }

  if (state.status === "loading" && event.type === "reject") {
    return {
      status: "failure",
      code: event.code,
      reason: event.reason
    }
  }

  return state
})

// Helper to clean error messages into a single line
function cleanErrorMessage(err: Error | any): string {
  const message = err?.message || String(err)
  return message.replace(/\r?\n/g, " ").replace(/\s+/g, " ").trim()
}

// 5. CLI Entrypoint
function main() {
  let input: string
  try {
    input = fs.readFileSync(0, "utf-8")
  } catch (err) {
    console.log(`INVALID: Failed to read from stdin: ${cleanErrorMessage(err)}`)
    process.exit(0)
  }

  let rawJson: any
  try {
    rawJson = JSON.parse(input)
  } catch (err) {
    console.log(`INVALID: Invalid JSON: ${cleanErrorMessage(err)}`)
    process.exit(0)
  }

  let parsed: InputDocument
  try {
    parsed = InputDocument.assert(rawJson)
  } catch (err) {
    console.log(`INVALID: ${cleanErrorMessage(err)}`)
    process.exit(0)
  }

  let state = parsed.initial
  try {
    for (const event of parsed.events) {
      state = transition(state, event)
    }
  } catch (err) {
    console.log(`INVALID: ${cleanErrorMessage(err)}`)
    process.exit(0)
  }

  console.log("VALID")
  console.log(JSON.stringify(state))
}

// Only run main if this file is executed directly
if (import.meta.url.endsWith(process.argv[1]) || process.argv[1]?.endsWith("cli.ts")) {
  main()
}
