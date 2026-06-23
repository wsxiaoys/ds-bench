import { type } from "arktype";

export const PayloadSchema = type(
    {
        kind: "'int'",
        value: type("string.numeric").pipe((s) => parseInt(s, 10))
    },
    "|",
    {
        kind: "'raw'",
        value: "string"
    }
);
