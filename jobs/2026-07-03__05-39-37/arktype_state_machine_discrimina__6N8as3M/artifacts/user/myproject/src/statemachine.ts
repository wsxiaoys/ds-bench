import { type } from "arktype";

/**
 * `State` is a discriminated union keyed on the literal `status` field.
 *
 * Each branch is a plain object Type (no morphs) so that ArkType resolves the
 * union deterministically via the `status` literal discriminator.
 *
 * Branches:
 *  - Idle    : { status: "idle" }
 *  - Loading : { status: "loading",  startedAt: non-negative integer }
 *  - Success : { status: "success",  data: unknown, fetchedAt: non-negative integer }
 *  - Failure : { status: "failure",  code: integer in [400, 599], reason: string len 1..200 }
 *
 * Integer constraints use the divisor form `number % 1` (divisible by 1) which
 * ArkType reports as "must be an integer"; bounds are combined inline.
 */
// Integer = number divisible by 1 (`divisibleBy(1)`); bounds are applied via
// the fluent NumberType methods, which are fully type-checked.
const nonNegInt = type.number.divisibleBy(1).atLeast(0);
const httpCode = type.number.divisibleBy(1).atLeast(400).atMost(599);
const reasonStr = type.string.atLeastLength(1).atMostLength(200);

export const State = type({
    status: '"idle"',
})
    .or({
        status: '"loading"',
        startedAt: nonNegInt,
    })
    .or({
        status: '"success"',
        data: "unknown",
        fetchedAt: nonNegInt,
    })
    .or({
        status: '"failure"',
        code: httpCode,
        reason: reasonStr,
    });

export type State = typeof State.infer;

/**
 * `Event` is a discriminated union keyed on the literal `type` field.
 *
 * Branches:
 *  - Start  : { type: "start",   at: number }
 *  - Resolve: { type: "resolve", data: unknown, at: number }
 *  - Reject : { type: "reject",  code: integer, reason: string, at: number }
 *  - Reset  : { type: "reset" }
 */
export const Event = type({
    type: '"start"',
    at: "number",
})
    .or({
        type: '"resolve"',
        data: "unknown",
        at: "number",
    })
    .or({
        type: '"reject"',
        code: type.number.divisibleBy(1),
        reason: "string",
        at: "number",
    })
    .or({
        type: '"reset"',
    });

export type Event = typeof Event.infer;

/** Truncate a number to an integer (towards zero), as required by the rules. */
const truncInt = (n: number): number => Math.trunc(n);

/**
 * The core transition logic, expressed as a pure (un-validated) function.
 *
 * Only the listed state/event pairings change the state; every other
 * combination leaves the state unchanged.
 */
function applyTransition(state: State, event: Event): State {
    // Reset wins from any state.
    if (event.type === "reset") {
        return { status: "idle" };
    }

    if (state.status === "idle" && event.type === "start") {
        return { status: "loading", startedAt: truncInt(event.at) };
    }

    if (state.status === "loading" && event.type === "resolve") {
        return {
            status: "success",
            data: event.data,
            fetchedAt: truncInt(event.at),
        };
    }

    if (state.status === "loading" && event.type === "reject") {
        return {
            status: "failure",
            code: event.code,
            reason: event.reason,
        };
    }

    // No matching rule: state is unchanged.
    return state;
}

/**
 * `transition` is a runtime-validated function.
 *
 * `type.fn(State, Event, ":", State)` wraps `applyTransition` so that:
 *  - the first parameter  is validated against `State`,
 *  - the second parameter is validated against `Event`,
 *  - the returned value   is validated against `State`.
 *
 * Any validation failure (invalid input state, invalid event, or an invalid
 * state produced by the transition logic) throws an `ArkErrors`-style
 * `TraversalError` at the boundary.
 */
export const transition = type.fn(State, Event, ":", State)(applyTransition);