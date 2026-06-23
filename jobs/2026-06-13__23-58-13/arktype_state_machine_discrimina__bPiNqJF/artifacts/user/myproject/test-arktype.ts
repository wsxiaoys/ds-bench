import { type } from "arktype";
const State = type({ status: "'idle'" }).or({ status: "'loading'", startedAt: "number.integer >= 0" });
console.log(State({ status: "idle" }));
console.log(State({ status: "loading", startedAt: -1 }));
