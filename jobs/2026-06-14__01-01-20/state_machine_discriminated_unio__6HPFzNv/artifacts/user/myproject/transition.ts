import { type } from "arktype";
import { State, Event } from "./state.js";
import type { State as StateType, Event as EventType } from "./state.js";

// The raw transition logic - implements the transition rules.
// This function assumes inputs are already validated.
function rawTransition(state: StateType, event: EventType): StateType {
  // Reset rule: any state + Reset -> Idle
  if (event.type === "reset") {
    return { status: "idle" };
  }

  // Idle + Start -> Loading
  if (state.status === "idle" && event.type === "start") {
    return { status: "loading", startedAt: Math.trunc(event.at) };
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

  // All other combinations: state unchanged
  return state;
}

// Wrap the transition function with runtime validation using arktype's fn.
// Both parameters and return value are validated against State and Event.
export const transition = type.fn(
  State,
  Event,
  ":",
  State
)(rawTransition);
