import { type, scope } from "arktype"

// 1. Literal-string union: fixed set of role names
export const Role = type("'admin' | 'editor' | 'viewer'")

// 2. Morph: parses a comma-separated string into an array of trimmed strings.
// Input is "string", output is "string[]" (using the "=>" morph operator).
export const CommaSeparatedList = type(
  "string",
  "=>",
  (s: string) =>
    s
      .split(",")
      .map((item) => item.trim())
      .filter((item) => item.length > 0),
)

// 3. Discriminated union: shapes with a literal "kind" tag
export const Shape = type(
  {
    kind: "'circle'",
    radius: "number",
  },
  "|",
  {
    kind: "'rectangle'",
    width: "number",
    height: "number",
  },
  "|",
  {
    kind: "'triangle'",
    base: "number",
    height: "number",
  },
)

// 4. Recursive type via scope().export(): a JSON-like value
// Using object-literal syntax with [string] index signatures
export const JSONValue = scope({
  JsonPrimitive: "string | number | boolean | null",
  JsonArray: "(JsonPrimitive | JsonObject | JsonArray)[]",
  JsonObject: {
    "[string]": "JsonPrimitive | JsonObject | JsonArray",
  },
}).export()
