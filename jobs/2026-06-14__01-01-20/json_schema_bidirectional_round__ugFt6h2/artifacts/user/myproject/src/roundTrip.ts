import { type, type Type } from "arktype"
import { jsonSchemaToType } from "@ark/json-schema"

/**
 * Export an ArkType schema to a JSON Schema document (draft-2020-12).
 *
 * The returned object contains the `$schema` field set to the draft-2020-12 URI.
 */
export function exportJsonSchema(schema: Type): object {
  const jsonSchema = schema.toJsonSchema()
  // toJsonSchema already includes $schema when called with default options,
  // but ensure it's present for the contract.
  if (!("$schema" in jsonSchema)) {
    ;(jsonSchema as Record<string, unknown>).$schema =
      "https://json-schema.org/draft/2020-12/schema"
  }
  return jsonSchema
}

/**
 * Round-trip an ArkType schema through JSON Schema and back.
 *
 * 1. Export `schema` to JSON Schema (draft-2020-12) via `schema.toJsonSchema()`.
 * 2. Re-parse the resulting JSON Schema back into an ArkType `Type` using
 *    `@ark/json-schema`'s `jsonSchemaToType`.
 * 3. Return the re-parsed Type.
 */
export function roundTrip(schema: Type): Type {
  const jsonSchema = exportJsonSchema(schema)
  // jsonSchemaToType returns a Type from @ark/json-schema's bundled arktype.
  // The returned type is callable and behaves as a Type.
  return jsonSchemaToType(jsonSchema) as Type
}
