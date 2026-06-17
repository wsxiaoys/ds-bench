import { type, type Type } from "arktype"
import { jsonSchemaToType } from "@ark/json-schema"

const JSON_SCHEMA_DRAFT_2020_12 = "https://json-schema.org/draft/2020-12/schema"

/**
 * Check if a validation result is an ArkErrors instance (validation failure).
 * Uses duck-typing to work across different arktype package instances.
 */
function isArkErrors(result: unknown): boolean {
  return (
    typeof result === "object" &&
    result !== null &&
    "count" in result &&
    "byPath" in result
  )
}

/**
 * Export an ArkType Type to a JSON Schema document (draft-2020-12).
 * The returned object includes the `$schema` field.
 */
export function exportJsonSchema(schema: Type): object {
  const jsonSchema = schema.toJsonSchema() as Record<string, unknown>
  // Ensure $schema is present for draft-2020-12
  jsonSchema.$schema = JSON_SCHEMA_DRAFT_2020_12
  return jsonSchema
}

/**
 * Round-trip an ArkType Type through JSON Schema:
 *   1. Export the Type to JSON Schema (draft-2020-12)
 *   2. Re-parse the JSON Schema back into an ArkType Type
 *   3. Return the re-parsed Type
 */
export function roundTrip(schema: Type): Type {
  const jsonSchema = exportJsonSchema(schema)
  return jsonSchemaToType(jsonSchema)
}