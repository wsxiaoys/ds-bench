import { type } from "arktype";
const State = type(
    { status: "'idle'" },
    "|",
    { status: "'loading'", startedAt: "number.integer >= 0" },
    "|",
    { status: "'success'", data: "unknown", fetchedAt: "number.integer >= 0" },
    "|",
    { status: "'failure'", code: "number.integer >= 400 <= 599", reason: "string >= 1 <= 200" }
);
console.log(State({ status: "failure", code: 500, reason: "Server Error" }).summary);
