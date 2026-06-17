import { type, type Type } from "arktype"
import { jsonSchemaToType } from "@ark/json-schema"

/**
 * Export an ArkType schema to a JSON Schema draft-2020-12 document.
 *
 * The returned object MUST contain `$schema` set to the draft-2020-12 URI:
 *   https://json-schema.org/draft/2020-12/schema
 */
export function exportJsonSchema(schema: Type): object {
  // schema.toJsonSchema() returns a JsonSchema object; by default it includes
  // $schema set to draft-2020-12. We explicitly pass the dialect option to be safe.
  const jsonSchema = schema.toJsonSchema({
    dialect: "https://json-schema.org/draft/2020-12/schema",
  })
  return jsonSchema as object
}

/**
 * Round-trip an ArkType schema through JSON Schema draft-2020-12 and back.
 *
 * 1. Export `schema` to JSON Schema via `exportJsonSchema()`.
 * 2. Re-parse the resulting JSON Schema back into an ArkType `Type`
 *    using `jsonSchemaToType` from `@ark/json-schema`.
 * 3. Return the re-parsed Type.
 */
export function roundTrip(schema: Type): Type {
  const jsonSchema = exportJsonSchema(schema)
  // jsonSchemaToType expects a JsonSchemaOrBoolean; we pass the full document
  // (which includes $schema, but $schema is just metadata and doesn't affect validation)
  return jsonSchemaToType(jsonSchema as any) as Type
}
