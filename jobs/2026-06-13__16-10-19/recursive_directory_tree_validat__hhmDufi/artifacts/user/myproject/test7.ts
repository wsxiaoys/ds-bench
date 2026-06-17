import { type } from "arktype";
const t = type({ a: "string", "-": "never" }); // wait, no
console.log(t.assert({ a: "hi" }));
