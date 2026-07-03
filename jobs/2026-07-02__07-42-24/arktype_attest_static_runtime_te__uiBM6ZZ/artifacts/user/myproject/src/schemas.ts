import { type, scope } from "arktype"

// 1. Morph pipe type using tuple form
export const parsedNumber = type(["string", "=>", (s: string) => {
    const n = Number(s)
    return isNaN(n) ? s : n
}])

// 2. Recursive scope type
export const recursiveScope = scope({
    LinkedList: {
        value: "number",
        "next?": "LinkedList"
    }
})

export const LinkedList = recursiveScope.export().LinkedList

// 3. Discriminated union
export const vehicle = type({
    type: "'car'",
    doors: "number"
}).or({
    type: "'bike'",
    gears: "number"
})

// 4. Literal-string union
export const role = type("'admin' | 'user' | 'guest'")
