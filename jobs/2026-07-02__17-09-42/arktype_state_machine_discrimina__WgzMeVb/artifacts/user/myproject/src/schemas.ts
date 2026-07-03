import { type } from "arktype";

/**
 * `State` - the machine's state, modelled as a true discriminated union
 * keyed by the `status` literal so that ArkType can resolve each branch
 * deterministically (rather than relying on a plain `or` chain of differently
 * morphed objects).
 *
 * Branches:
 *   - Idle:    { status: "idle" }
 *   - Loading: { status: "loading", startedAt: non-negative integer }
 *   - Success: { status: "success", data: unknown, fetchedAt: non-negative integer }
 *   - Failure: { status: "failure", code: integer in [400, 599], reason: string 1..200 }
 */
export const State = type.or(
  { status: '"idle"' },
  {
    status: '"loading"',
    startedAt: "number.integer >= 0",
  },
  {
    status: '"success"',
    data: "unknown",
    fetchedAt: "number.integer >= 0",
  },
  {
    status: '"failure"',
    code: "400 <= number.integer <= 599",
    reason: "1 <= string <= 200",
  },
);

/**
 * `Event` - the incoming event, modelled as a true discriminated union
 * keyed by the `type` literal.
 *
 * Branches:
 *   - Start:   { type: "start", at: number }
 *   - Resolve: { type: "resolve", data: unknown, at: number }
 *   - Reject:  { type: "reject", code: number, reason: string, at: number }
 *   - Reset:   { type: "reset" }
 */
export const Event = type.or(
  {
    type: '"start"',
    at: "number",
  },
  {
    type: '"resolve"',
    data: "unknown",
    at: "number",
  },
  {
    type: '"reject"',
    code: "number",
    reason: "string",
    at: "number",
  },
  {
    type: '"reset"',
  },
);

export type State = typeof State.infer;
export type Event = typeof Event.infer;
