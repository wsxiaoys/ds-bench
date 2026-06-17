import { type } from "arktype";
const t = type({ a: "string", "b?": "never" });
console.log(t({ a: "hi", b: 1 }).problems?.summary);
