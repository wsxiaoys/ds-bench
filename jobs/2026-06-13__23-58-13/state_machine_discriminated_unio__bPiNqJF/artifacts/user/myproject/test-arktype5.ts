import { type } from "arktype";
const S = type("number");
const E = type("number");
const transition = type(S, E, "=>", S).assert((s, e) => {
    return s + e;
});
console.log(transition(1, 2));
try {
    transition("a", 2);
} catch (e) {
    console.log(e.message);
}
