import { type, scope } from "arktype"

export const parsedInt = type(["string.numeric", "=>", (s: string) => parseInt(s, 10)])

const types = scope({
    user: {
        name: "string",
        "friends?": "user[]"
    }
}).export()
export const user = types.user

export const event = type(
    { kind: "'click'", x: "number", y: "number" },
    "|",
    { kind: "'keypress'", key: "string" }
)

export const role = type("'admin' | 'user' | 'guest'")
