import { type, scope } from "arktype"

// 1. Literal-string union type
export const roleUnion = type("'admin' | 'user' | 'guest'")

// 2. Discriminated union type
export const userUnion = type({
  role: "'admin'",
  adminCode: "string"
}).or({
  role: "'user'",
  userId: "number"
})

// 3. Type built with a recursive scope({...}).export()
const listNodeScope = scope({
  listNode: {
    val: "number",
    "next?": "listNode"
  }
})
export const listNodeTypes = listNodeScope.export()
export const recursiveNode = listNodeTypes.listNode

// 4. Type built with a morph (input is transformed/parsed into a different shape)
export const trimmedString = type(["string", "=>", (s: string) => s.trim()])
