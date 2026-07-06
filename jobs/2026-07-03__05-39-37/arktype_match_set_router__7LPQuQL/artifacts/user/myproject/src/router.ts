import { match } from "arktype"

/**
 * A match-based event router built with ArkType's `match` pattern matcher.
 *
 * The first three cases (a bare `string`, a bare `number`, and a `string[]`)
 * are expressed as object-literal keys in the initial `match({...})` record.
 *
 * The remaining cases describe nested, discriminated objects (click events
 * discriminated on `target.type` and a submit event) and are therefore added
 * via the fluent `.case(def, handler)` API, which is more convenient for
 * nested shapes.
 *
 * `default: "assert"` ensures that any event failing to match one of the
 * explicit cases causes `route` to throw a `TraversalError` instead of
 * silently returning `undefined`.
 */
export const route = match({
  string: (In: string) => `text:${In.length}`,
  number: (In: number) => `num:${In}`,
  "string[]": (In: string[]) => `list:${In.length}`,
})
  .case(
    { kind: "'click'", target: { type: "'button'", id: "string" } },
    (In) => `btn:${In.target.id}`,
  )
  .case(
    { kind: "'click'", target: { type: "'link'", href: "string.url" } },
    (In) => `link:${In.target.href}`,
  )
  .case(
    { kind: "'submit'", payload: { formId: "string", valid: "boolean" } },
    (In) => `submit:${In.payload.formId}:${In.payload.valid}`,
  )
  .default("assert")