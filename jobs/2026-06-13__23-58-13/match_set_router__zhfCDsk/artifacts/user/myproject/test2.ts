import { match, type } from "arktype";

console.log(match({
    string: (s: string) => `text:${s.length}`,
    number: (n: number) => `num:${n}`,
    "string[]": (arr: string[]) => `list:${arr.length}`
})
.case({
    kind: "'click'",
    target: { type: "'button'", id: "string" }
}, (e) => `btn:${e.target.id}`)
.case({
    kind: "'click'",
    target: { type: "'link'", href: "string.url" }
}, (e) => `link:${e.target.href}`)
.case({
    kind: "'submit'",
    payload: { formId: "string", valid: "boolean" }
}, (e) => `submit:${e.payload.formId}:${e.payload.valid}`)
.default("assert").toString());
