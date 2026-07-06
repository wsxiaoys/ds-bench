# Match-Based Event Router (ArkType)

## Background
Build a TypeScript CLI in `/home/user/myproject` that routes heterogeneous events using ArkType 2.2.0's `match` pattern matcher. Events arrive as a JSON document on stdin and the router must dispatch each one to the appropriate handler based on its set-theoretic shape, including primitives, arrays, and discriminated nested objects.

## Requirements
- Implement a matcher named `route` constructed via `match({...})` (from `arktype`) in `src/router.ts`.
- The router source in `src/router.ts` MUST reference the click `kind` and the submit `kind` as distinct literal values (e.g., `'click'` and `'submit'`) so the discriminator is observable.
- The matcher must handle AT LEAST the following six explicit cases plus a default:
  1. A bare `string` → produces `text:<length>` (where `<length>` is the string's character length).
  2. A bare `number` → produces `num:<value>`.
  3. A `string[]` → produces `list:<length>`.
  4. A click event whose `target.type` is `"button"` with an `id` string → produces `btn:<target.id>`.
  5. A click event whose `target.type` is `"link"` with an `href` that must be a valid URL → produces `link:<target.href>`.
  6. A submit event with a `payload` containing a `formId` string and a `valid` boolean → produces `submit:<formId>:<valid>`.
- Any event that does not match any of the above cases MUST cause `route` to throw a `TraversalError` (configure `default: "assert"`).
- Build a TypeScript CLI in `cli.ts` (located in the project root `/home/user/myproject`) that reads a single JSON document of the form `{"events": [...]}` from stdin, iterates through `events` in order, and applies the `route` matcher to each item.
- For every successfully routed event, the CLI prints the routed string on its own stdout line, in the original input order.
- The first time `route` throws (because of the `"assert"` default), the CLI MUST print one final line of the form `ERR <message>` to stdout and STOP processing the remaining events. Lines printed for previously routed events MUST already be on stdout.
- The CLI MUST always exit with status code 0, regardless of whether a default rejection occurred.

## Implementation Hints
- Consult the ArkType docs for `match` and decide how to express each case (some are convenient as object-literal keys in the case record, while nested-object cases may be easier to express via the fluent `.case({...}, handler)` API). The two click cases differ only in the value of `target.type`, so the matcher must discriminate on that nested field.
- ArkType's `"string.url"` keyword can be used to require that the link `href` is a syntactically valid URL.
- Keep the matcher in `src/router.ts` and the CLI in `cli.ts` so the routing logic can be exercised independently of stdin/stdout plumbing.
- Use `tsx` to execute the TypeScript CLI directly; `arktype@2.2.0` and `tsx` are already installed in `/home/user/myproject`.
- `tsconfig.json` is preconfigured with `module: NodeNext` and `moduleResolution: NodeNext`.
- To run the CLI, use: `npx --no-install tsx cli.ts`

