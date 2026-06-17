# State Machine with Discriminated Unions (ArkType)

## Background
Build a runtime-validated state machine using `arktype@2.2.0`. Both the machine's `State` and the incoming `Event` are modelled as discriminated unions, and the transition function itself must be a runtime-validated function so that any invalid state or event - whether produced by the transition logic or supplied as input - is caught at the boundary.

## Requirements
- Implement the project under `/home/user/myproject` (TypeScript, ESM, NodeNext).
- Define `State` as a discriminated union over a `status` literal field with exactly these branches:
  - `Idle`: `status` is the literal `"idle"`.
  - `Loading`: `status` is the literal `"loading"`; carries `startedAt` as a non-negative integer.
  - `Success`: `status` is the literal `"success"`; carries `data` of any value and `fetchedAt` as a non-negative integer.
  - `Failure`: `status` is the literal `"failure"`; carries `code` as an integer in the inclusive range `[400, 599]` and `reason` as a string of length 1..200.
- Define `Event` as a discriminated union over a `type` literal field with exactly these branches:
  - `Start`: `type` is the literal `"start"`; carries `at` as a number.
  - `Resolve`: `type` is the literal `"resolve"`; carries `data` of any value and `at` as a number.
  - `Reject`: `type` is the literal `"reject"`; carries `code` as an integer, `reason` as a string, and `at` as a number.
  - `Reset`: `type` is the literal `"reset"`.
- Implement a `transition(state, event)` function whose runtime contract is fully validated: parameters are checked against `State` and `Event`, and the return value is checked against `State`.
- Transition rules (apply only the listed pairings; every other state/event combination must leave the state unchanged):
  - `Idle` + `Start` -> `Loading` with `startedAt = event.at` (truncated to integer if needed).
  - `Loading` + `Resolve` -> `Success` with `data = event.data` and `fetchedAt = event.at` (truncated to integer if needed).
  - `Loading` + `Reject` -> `Failure` with `code = event.code` and `reason = event.reason`.
  - Any state + `Reset` -> `Idle`.
- Build a CLI entrypoint that reads a single JSON document from stdin with the shape `{"initial": <State>, "events": [<Event>, ...]}`, replays the events through `transition`, and prints the outcome to stdout.

## Implementation Hints
- Both unions must be true discriminated unions keyed by a literal tag so that ArkType can resolve each branch deterministically; do not rely on plain `or` chains of differently-morphed objects.
- The transition function must be wrapped so that both the inputs and the result are validated at runtime.
- The CLI may invoke the transition function directly; the runtime validation will reject malformed states or events with an `ArkErrors`-style failure that you must convert into the required stdout format.
- The CLI must always exit with code 0 even when the input is rejected.

## Acceptance Criteria
- Project path: /home/user/myproject
- Command: `npx --no-install tsx cli.ts`
- Input: a single JSON document piped through stdin with the shape `{"initial": <State>, "events": [<Event>, ...]}`.
- Output (stdout):
  - On success: the first non-empty line MUST be exactly `VALID`, and the next non-empty line MUST be a JSON-stringified `State` describing the final state after replaying every event in order.
  - On any validation failure (invalid `initial`, invalid event payload, transition produced an invalid state): a single non-empty line beginning with `INVALID: ` followed by an error description.
- Exit code: `0` for both the success and invalid cases.
- `arktype@2.2.0` and `tsx` are preinstalled at `/home/user/myproject`. `tsconfig.json` is preconfigured with `module: NodeNext` and `moduleResolution: NodeNext`.

