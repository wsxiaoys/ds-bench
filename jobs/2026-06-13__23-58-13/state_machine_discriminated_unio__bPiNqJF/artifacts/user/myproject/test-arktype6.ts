import { type } from "arktype";
const transition = type("(s: number, e: number) => number").assert((s, e) => {
    return s + e;
});
console.log(transition(1, 2));
