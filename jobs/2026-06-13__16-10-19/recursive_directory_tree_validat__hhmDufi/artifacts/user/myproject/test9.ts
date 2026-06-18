import { type } from "arktype";
const t = type({ a: "string", "+": "reject" });
console.log(t({ a: "hi", b: 1 }).problems?.summary);
console.log(t({ a: "hi" }).problems?.summary);
