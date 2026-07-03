import { type } from "arktype";

const a = type({ x: "number.integer >= 100 <= 599" });
const b = type({ x: "number.integer >= 100 & <= 599" });
const c = type({ x: "number.integer > 0 & <= 10000" });
const d = type({ x: "number.integer >= 0 & <= 5" });

console.log(a.expression, b.expression, c.expression, d.expression);
export {};