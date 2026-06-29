# Unit Conversion Engine with ArkType `match`

## Goal
Build a Node.js CLI in `/home/user/myproject` with the entrypoint `convert.js` (run as `node convert.js`) that reads a single JSON object from STDIN and prints a formatted imperial-unit string to STDOUT, using ArkType's `match` API for dispatch.

The project must have `arktype` version `2.2.0` installed.

## Implementation Details
- **Input & Output**: The application reads a single JSON object from STDIN.
- **Matching & Exhaustiveness**: The implementation must use ArkType's `match({...})({...})` structure with an explicit `default: "assert"` configuration to ensure exhaustiveness. Unmatched inputs (such as `{ kind: "volume", liters: 1 }`) must cause the converter to throw an error.
- **Supported Conversions**:
  - Length: `{ kind: "length", meters: 1 }` must return a string containing `3.28` (feet).
  - Mass: `{ kind: "mass", kilograms: 1 }` must return a string containing `2.20` (pounds).
  - Temperature: `{ kind: "temperature", celsius: 0 }` must return a string containing `32` (Fahrenheit).

