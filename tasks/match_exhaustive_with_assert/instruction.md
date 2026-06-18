# Unit Conversion Engine with ArkType `match`

## Goal
Build a Node.js CLI in `/home/user/myproject` that reads a single JSON object from STDIN and prints a formatted imperial-unit string to STDOUT, using ArkType's `match` API for dispatch.

## Acceptance Criteria
- Project path: `/home/user/myproject`
- `arktype` version installed must be exactly `2.2.0`.
- Command: `node convert.js`
- Input: A single JSON object provided on STDIN.
- Test criteria (all enforced):
  1. `{ kind: "length", meters: 1 }` MUST return a string containing "3.28" (feet).
  2. `{ kind: "mass", kilograms: 1 }` MUST return a string containing "2.20" (pounds).
  3. `{ kind: "temperature", celsius: 0 }` MUST return a string containing "32" (Fahrenheit).
  4. `{ kind: "volume", liters: 1 }` MUST cause the converter to throw.
  5. The implementation MUST use `match({...})({...})` with explicit `default: "assert"`.

