import { type } from "arktype";
const State = type({ status: "'idle'" }).or({ status: "'loading'", startedAt: "number.integer >= 0" });
const out = State({ status: "loading", startedAt: -1 });
if (out instanceof type.errors) {
    console.log("INVALID:", out.summary);
} else {
    console.log("VALID:", out);
}
