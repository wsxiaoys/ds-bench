import { type } from "arktype"
import { jsonSchemaToType } from "@ark/json-schema"

// The draft-2020-12 $schema URI
const DRAFT_2020_12 = "https://json-schema.org/draft/2020-12/schema"

/**
 * Export an ArkType `schema` to JSON Schema draft-2020-12.
 * The returned object always contains the `$schema` field.
 */
export function exportJsonSchema(schema: type.Any): object {
  const jsonSchema = schema.toJsonSchema({ dialect: DRAFT_2020_12 })
  // toJsonSchema already adds $schema when dialect is provided (non-null),
  // but ensure it's present regardless
  if (!("$schema" in (jsonSchema as object))) {
    return { $schema: DRAFT_2020_12, ...(jsonSchema as object) }
  }
  return jsonSchema as object
}

/**
 * Round-trip an ArkType schema through JSON Schema:
 *  1. Export to JSON Schema draft-2020-12 via `toJsonSchema()`.
 *  2. Re-parse back into an ArkType `Type` via `@ark/json-schema`.
 *  3. Return the re-parsed Type.
 */
export function roundTrip(schema: type.Any): type.Any {
  const jsonSchema = exportJsonSchema(schema)
  return jsonSchemaToType(jsonSchema) as type.Any
}
