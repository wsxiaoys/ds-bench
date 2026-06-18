import { type } from "arktype";
const State1 = type({ status: "'idle'" }).or({ status: "'loading'", startedAt: "number.integer >= 0" });
const State2 = type(
    { status: "'idle'" },
    "|",
    { status: "'loading'", startedAt: "number.integer >= 0" }
);
console.log(JSON.stringify(State1.json) === JSON.stringify(State2.json));
