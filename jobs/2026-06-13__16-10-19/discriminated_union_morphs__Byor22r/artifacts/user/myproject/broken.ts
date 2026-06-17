import { type } from "arktype";

const brokenSchema = type(
    {
        value: type("string.numeric").pipe((s) => parseInt(s, 10))
    },
    "|",
    {
        value: "string"
    }
);
