import type { Type } from "arktype"
import { jsonSchemaToType } from "@ark/json-schema"

/**
 * Bidirectional ArkType <-> JSON Schema round trip.
 *
 * `roundTrip(schema)` MUST:
 *   1. Export `schema` to JSON Schema (draft-2020-12) via `schema.toJsonSchema()`.
 *   2. Re-parse the resulting JSON Schema back into an ArkType `Type` using
 *      `@ark/json-schema`.
 *   3. Return the re-parsed Type.
 */
export function roundTrip(schema: Type): Type {
  const jsonSchema = exportJsonSchema(schema)
  return jsonSchemaToType(jsonSchema as any) as any
}

/**
 * JSON Schema export used as the round-trip intermediate.
 * The returned object MUST contain `$schema` set to the draft-2020-12 URI:
 *   https://json-schema.org/draft/2020-12/schema
 */
export function exportJsonSchema(schema: Type): object {
  const jsonSchema = schema.toJsonSchema() as any
  if (!jsonSchema.$schema) {
    jsonSchema.$schema = "https://json-schema.org/draft/2020-12/schema"
  }
  return jsonSchema
}
