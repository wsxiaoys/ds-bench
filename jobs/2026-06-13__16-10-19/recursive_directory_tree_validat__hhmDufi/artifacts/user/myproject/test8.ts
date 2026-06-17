import { type } from "arktype";
const t = type({ a: "string", "+": "exact" });
console.log(t({ a: "hi", b: 1 }).problems?.summary);
