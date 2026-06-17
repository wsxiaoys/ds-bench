import { type } from "arktype";
const t = type("exact", { a: "string" });
console.log(t({ a: "hi", b: 1 }).problems?.summary);
