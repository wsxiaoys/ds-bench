import { scope, type ArkErrors, type TraversalError } from "arktype"

export const $ = scope({
  Idle: { status: "'idle'" },
  Loading: { status: "'loading'", startedAt: "number%1>=0" },
  Success: { status: "'success'", data: "unknown", fetchedAt: "number%1>=0" },
  Failure: {
    status: "'failure'",
    code: "number%1>=400&number%1<=599",
    reason: "string>=1&string<=200",
  },
  Start: { type: "'start'", at: "number" },
  Resolve: { type: "'resolve'", data: "unknown", at: "number" },
  Reject: { type: "'reject'", code: "number%1", reason: "string", at: "number" },
  Reset: { type: "'reset'" },
  State: "Idle | Loading | Success | Failure",
  Event: "Start | Resolve | Reject | Reset",
})

export const types = $.export()
export const State = types.State
export const Event = types.Event

// Create a runtime-validated transition function using the scope's fn
export const transition = $.fn("State", "Event", ":", "State")(
  (state: any, event: any) => {
    if (state.status === "idle" && event.type === "start") {
      return { status: "loading", startedAt: Math.trunc(event.at) }
    }
    if (state.status === "loading" && event.type === "resolve") {
      return { status: "success", data: event.data, fetchedAt: Math.trunc(event.at) }
    }
    if (state.status === "loading" && event.type === "reject") {
      return { status: "failure", code: event.code, reason: event.reason }
    }
    if (event.type === "reset") {
      return { status: "idle" }
    }
    return state
  },
)

