import type { Type } from "arktype"
import { jsonSchemaToType } from "@ark/json-schema"

const DRAFT_2020_12_URI = "https://json-schema.org/draft/2020-12/schema"

/**
 * Export an ArkType Type to a JSON Schema document (draft-2020-12).
 * The returned object includes the `$schema` field.
 */
export function exportJsonSchema(schema: Type): object {
  return schema.toJsonSchema({ dialect: DRAFT_2020_12_URI })
}

/**
 * Round-trip an ArkType Type through JSON Schema:
 *   1. Convert to JSON Schema via toJsonSchema()
 *   2. Parse back into an ArkType Type via @ark/json-schema
 *   3. Return the re-parsed Type
 */
export function roundTrip(schema: Type): Type {
  const jsonSchema = exportJsonSchema(schema)
  return jsonSchemaToType(jsonSchema)
}