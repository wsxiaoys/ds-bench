import { match } from "arktype";

export const route = match({
  string: (s: string) => `text:${s.length}`,
  number: (n: number) => `num:${n}`,
  "string[]": (arr: string[]) => `list:${arr.length}`,
})
  .case(
    { kind: "'click'", target: { type: "'button'", id: "string" } },
    (e: { kind: "click"; target: { type: "button"; id: string } }) =>
      `btn:${e.target.id}`,
  )
  .case(
    { kind: "'click'", target: { type: "'link'", href: "string.url" } },
    (e: { kind: "click"; target: { type: "link"; href: string } }) =>
      `link:${e.target.href}`,
  )
  .case(
    { kind: "'submit'", payload: { formId: "string", valid: "boolean" } },
    (e: { kind: "submit"; payload: { formId: string; valid: boolean } }) =>
      `submit:${e.payload.formId}:${e.payload.valid}`,
  )
  .default("assert");