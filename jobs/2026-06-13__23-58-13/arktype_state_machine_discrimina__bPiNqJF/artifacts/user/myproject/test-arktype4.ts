import { type } from "arktype";
const C = type("number.integer >= 400 <= 599");
console.log(C(399).summary);
console.log(C(400));
console.log(C(599));
console.log(C(600).summary);
