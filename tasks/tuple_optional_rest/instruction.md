# Event Emit Module with ArkType `type.fn` Tuple Parameters

## Background
Build a tiny event-emitter module in `/home/user/myproject` whose public `emit(...args)` function has its **entire parameter signature** validated at runtime by `arktype@2.2.0`. The parameters are described as a single tuple with prefix, optional, and variadic elements, and `type.fn` consumes that tuple as the parameter list.

## Requirements
- Define a tuple-shaped parameter schema that, in TypeScript terms, looks like:
  `[eventName, timestamp, payload?, ...tags]` where:
  - `eventName` is an alphanumeric string with length between 1 and 50 (inclusive).
  - `timestamp` is a non-negative integer.
  - `payload` (optional) is an object `{ kind: string, data: unknown }`.
  - `tags` is a variadic rest of strings, each with length between 1 and 30 (inclusive).
- Wrap `emit(...args)` in `type.fn` so that its parameter list IS this tuple (every parameter is validated by the tuple, not a single object argument).
- `emit` constructs and returns `{ ok: true, event: { name, timestamp, payload?, tags } }` by destructuring the validated tuple. When no payload is provided, the `payload` property must be omitted from `event` (not set to `undefined`).
- Provide a CLI entrypoint that reads a single JSON line of the form `{"args": [...]}` from stdin, calls `emit(...args)`, and prints results to stdout.

## Implementation Hints
- ArkType 2.2 introduced `type.fn`. Its parameters are defined with the same syntax as tuple types, supporting prefix, optional, and variadic elements.
- Consult the ArkType docs on tuples and on `type.fn` to learn how to express optional and rest tuple elements.
- On invalid input, `type.fn` throws a `TraversalError` exposing a human-readable `message`.

## Acceptance Criteria
- Project path: /home/user/myproject
- Command: `npx --no-install tsx cli.ts`
- Input (stdin): a single JSON object `{"args": [...]}` whose `args` array is spread into `emit(...args)`.
- Output (stdout):
  - On success: a single line in the form `OK <json>` where `<json>` is the JSON-stringified return value of `emit`.
  - On `type.fn` rejection (`TraversalError` thrown): a single line in the form `ERR <message>` where `<message>` is the `message` property of the thrown error.
- The CLI MUST exit with code 0 for both success and rejection cases.
- Source layout: the validated function must be defined in `src/emit.ts` and the CLI in `cli.ts`.
- The implementation in `src/emit.ts` MUST be built via `type.fn(...)` so that the parameter list is validated as a tuple.
- `arktype@2.2.0` and `tsx` are preinstalled; `tsconfig.json` uses `module: NodeNext` / `moduleResolution: NodeNext`.

