import { match } from "arktype"

export const route = match({
  "string": (s) => `text:${s.length}`,
  "number": (n) => `num:${n}`,
  "string[]": (arr) => `list:${arr.length}`,
})
.case({
  kind: "'click'",
  target: {
    type: "'button'",
    id: "string"
  }
}, (event) => `btn:${event.target.id}`)
.case({
  kind: "'click'",
  target: {
    type: "'link'",
    href: "string.url"
  }
}, (event) => `link:${event.target.href}`)
.case({
  kind: "'submit'",
  payload: {
    formId: "string",
    valid: "boolean"
  }
}, (event) => `submit:${event.payload.formId}:${event.payload.valid}`)
.default("assert")
