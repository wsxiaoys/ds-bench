import { type } from "arktype";
const State = type(
    { status: "'idle'" },
    "|",
    { status: "'loading'", startedAt: "number.integer >= 0" }
);
console.log(State({ status: "idle" }));
