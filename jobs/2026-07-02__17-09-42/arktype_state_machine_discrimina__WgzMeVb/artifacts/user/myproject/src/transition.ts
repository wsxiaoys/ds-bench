import { type } from "arktype";
import { State, Event, type State as StateT, type Event as EventT } from "./schemas.js";

/**
 * Pure transition logic. Returns the *intended* next state for a valid
 * (state, event) pair, or the input state unchanged for any pair not
 * listed in the spec.
 *
 * The runtime validation of inputs/outputs lives in `transition` (below),
 * not here: this function is a plain implementation that *must* be invoked
 * through the validated wrapper so that malformed states/events are caught
 * at the boundary.
 */
export function transitionImpl(state: StateT, event: EventT): StateT {
  // `Reset` always returns `Idle`, irrespective of the current state.
  if (event.type === "reset") {
    return { status: "idle" };
  }

  if (state.status === "idle" && event.type === "start") {
    return {
      status: "loading",
      startedAt: Math.trunc(event.at),
    };
  }

  if (state.status === "loading" && event.type === "resolve") {
    return {
      status: "success",
      data: event.data,
      fetchedAt: Math.trunc(event.at),
    };
  }

  if (state.status === "loading" && event.type === "reject") {
    return {
      status: "failure",
      code: event.code,
      reason: event.reason,
    };
  }

  // Every other (state, event) pairing leaves the state unchanged.
  return state;
}

/**
 * `transition` - the public, runtime-validated transition function.
 *
 * Inputs are checked against `State` and `Event`, and the output is checked
 * against `State`. The implementation delegates to `transitionImpl`.
 *
 * Wrapped with `type.fn` so the contract is fully introspectable (`.params`,
 * `.returns`, `.expression`). `type.fn` throws a `TraversalError` whose
 * `.arkErrors` field carries the underlying `ArkErrors` when validation
 * fails; callers (e.g. `cli.ts`) translate that into the required stdout
 * format.
 */
export const transition = type.fn(State, Event, ":", State)(transitionImpl);
