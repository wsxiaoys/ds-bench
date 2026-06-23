import { type } from "arktype";
const S = type("string >= 1 <= 200");
console.log(S("").summary);
console.log(S("a"));
