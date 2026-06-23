import { type } from "arktype";

const schema = type({
    validityDays: "(1 <= number <= 365) & (number % 1)"
});

const res = schema({ validityDays: 365.5 });
if (res instanceof type.errors) {
    console.log("message:", res.message);
    console.log("summary:", res.summary);
    console.log("toString:", res.toString().replace(/\n/g, " "));
}
