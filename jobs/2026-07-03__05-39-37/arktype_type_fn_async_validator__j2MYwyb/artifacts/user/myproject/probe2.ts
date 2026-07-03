import { type } from "arktype";

// candidate range syntaxes
const a = type("number >= 100 <= 599");
const b = type("number >= 100 & <= 599");
const c = type("number.integer >= 100 & <= 599");
const d = type({ status: "number >= 100 <= 599" });
const e = type(["number.integer", ">", 0, "<=", 10000]);

console.log(a.expression, b.expression, c.expression, d.expression, e.expression);