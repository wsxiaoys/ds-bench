import { match } from "arktype";

const route = match({
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
.default("assert");

try {
    console.log(route({ kind: "click", target: { type: "button", id: 123 } }));
} catch (e: any) {
    console.log("ERR", e.message);
}
