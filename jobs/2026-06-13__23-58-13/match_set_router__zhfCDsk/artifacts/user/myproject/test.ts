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

console.log(route("hello"));
console.log(route(42));
console.log(route(["a", "b"]));
console.log(route({ kind: "click", target: { type: "button", id: "btn1" } }));
console.log(route({ kind: "click", target: { type: "link", href: "https://example.com" } }));
console.log(route({ kind: "submit", payload: { formId: "form1", valid: true } }));
try {
    console.log(route({ kind: "unknown" }));
} catch (e: any) {
    console.log("ERR", e.message);
}
