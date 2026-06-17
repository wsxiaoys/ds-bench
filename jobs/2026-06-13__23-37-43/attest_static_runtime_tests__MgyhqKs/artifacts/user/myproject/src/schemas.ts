import { scope, type } from "arktype"

// 1. Literal-string union: a fixed set of user roles
export const Role = type("'admin' | 'editor' | 'viewer'")
export type Role = typeof Role.infer

// 2. Morph: parse a raw string and trim it (input: string → output: string)
//    Uses the ["input", "=>", morphFn] tuple form
export const TrimmedString = type(["string", "=>", (s: string) => s.trim()])
export type TrimmedStringOut = typeof TrimmedString.infer

// 3. Discriminated union selected by a literal `kind` tag property
export const Shape = type({ kind: "'circle'", radius: "number" }).or({
	kind: "'rectangle'",
	width: "number",
	height: "number"
})
export type Shape = typeof Shape.infer

// 4. Recursive type via scope().export(): a JSON-like value tree
//    Uses an object-spread shape for the map branch to avoid the Record<k,v>
//    generic (which doesn't cross-reference aliases in scope).
export const { JsonValue } = scope({
	JsonPrimitive: "string | number | boolean | null",
	JsonValue: "JsonPrimitive | JsonValue[] | JsonObject",
	JsonObject: { "[string]": "JsonValue" }
}).export()
export type JsonValue = typeof JsonValue.infer
