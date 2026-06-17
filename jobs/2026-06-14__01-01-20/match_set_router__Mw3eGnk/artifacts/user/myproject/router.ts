import { match } from "arktype";

// Build the router using the fluent match API.
// We use .case() for discriminated object shapes and the object-literal
// form of match() for the primitive/array cases.
//
// The six required cases:
//   1. bare string       → text:<length>
//   2. bare number       → num:<value>
//   3. string[]          → list:<length>
//   4. click, target.type "button", id string   → btn:<target.id>
//   5. click, target.type "link", href a valid URL → link:<target.href>
//   6. submit, payload { formId: string, valid: boolean } → submit:<formId>:<valid>
//
// default: "assert" causes a TraversalError to be thrown on non-matching input.

export const route = match({
  string: (s: string) => `text:${s.length}`,
  number: (n: number) => `num:${n}`,
  "string[]": (arr: string[]) => `list:${arr.length}`,
})
  .case(
    {
      kind: "'click'",
      target: { type: "'button'", id: "string" },
    },
    (e) => `btn:${e.target.id}`
  )
  .case(
    {
      kind: "'click'",
      target: { type: "'link'", href: "string.url" },
    },
    (e) => `link:${e.target.href}`
  )
  .case(
    {
      kind: "'submit'",
      payload: { formId: "string", valid: "boolean" },
    },
    (e) => `submit:${e.payload.formId}:${e.payload.valid}`
  )
  .default("assert");
