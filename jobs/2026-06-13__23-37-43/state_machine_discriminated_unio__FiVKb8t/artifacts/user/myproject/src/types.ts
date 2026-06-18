import { type, fn } from "arktype";

// ---------------------------------------------------------------------------
// State – discriminated union on `status`
// ---------------------------------------------------------------------------

export const Idle = type({
  status: "'idle'",
});

export const Loading = type({
  status: "'loading'",
  startedAt: "number.integer >= 0",
});

export const Success = type({
  status: "'success'",
  data: "unknown",
  fetchedAt: "number.integer >= 0",
});

export const Failure = type({
  status: "'failure'",
  // inclusive range [400, 599]
  code: "number.integer >= 400 & number.integer <= 599",
  // length 1..200
  reason: "1 <= string <= 200",
});

export const State = Idle.or(Loading).or(Success).or(Failure);
export type State = typeof State.infer;

// ---------------------------------------------------------------------------
// Event – discriminated union on `type`
// ---------------------------------------------------------------------------

export const StartEvent = type({
  type: "'start'",
  at: "number",
});

export const ResolveEvent = type({
  type: "'resolve'",
  data: "unknown",
  at: "number",
});

export const RejectEvent = type({
  type: "'reject'",
  code: "number.integer",
  reason: "string",
  at: "number",
});

export const ResetEvent = type({
  type: "'reset'",
});

export const Event = StartEvent.or(ResolveEvent).or(RejectEvent).or(ResetEvent);
export type Event = typeof Event.infer;

// ---------------------------------------------------------------------------
// Validated transition function
// ---------------------------------------------------------------------------

/**
 * Runtime-validated state-machine transition.
 *
 * Both parameters are checked against their respective union types, and the
 * return value is checked against `State` before being handed back to the
 * caller.  Any violation throws an `ArkErrors`-style error.
 */
export const transition = fn(State, Event, ":", State)(
  (state, event): State => {
    // Any state + Reset -> Idle
    if (event.type === "reset") {
      return { status: "idle" };
    }

    // Idle + Start -> Loading
    if (state.status === "idle" && event.type === "start") {
      return {
        status: "loading",
        startedAt: Math.trunc(event.at),
      };
    }

    // Loading + Resolve -> Success
    if (state.status === "loading" && event.type === "resolve") {
      return {
        status: "success",
        data: event.data,
        fetchedAt: Math.trunc(event.at),
      };
    }

    // Loading + Reject -> Failure
    if (state.status === "loading" && event.type === "reject") {
      return {
        status: "failure",
        code: event.code,
        reason: event.reason,
      };
    }

    // All other combinations: leave state unchanged
    return state;
  },
);
