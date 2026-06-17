import { type } from "arktype"
import type { Type } from "arktype"
import { jsonSchemaToType } from "@ark/json-schema"

const DRAFT_2020_12 = "https://json-schema.org/draft/2020-12/schema"

/**
 * Exports `schema` to JSON Schema (draft-2020-12) via `schema.toJsonSchema()`,
 * ensuring the `$schema` field is present.
 */
export function exportJsonSchema(schema: Type): object {
  const jsonSchema = schema.toJsonSchema({ target: "draft-2020-12" })
  // toJsonSchema with target "draft-2020-12" already adds $schema, but
  // we ensure it's present and correct regardless.
  return {
    $schema: DRAFT_2020_12,
    ...jsonSchema,
  }
}

/**
 * Round-trips `schema` through JSON Schema draft-2020-12 and back into
 * an ArkType `Type`.
 *
 * 1. Export `schema` to JSON Schema via `exportJsonSchema`.
 * 2. Re-parse the JSON Schema back into a `Type` using `@ark/json-schema`.
 * 3. Return the re-parsed Type.
 */
export function roundTrip(schema: Type): Type {
  const jsonSchema = exportJsonSchema(schema)
  // Remove $schema key before passing to jsonSchemaToType since it
  // doesn't understand the meta key.
  const { $schema: _removed, ...rest } = jsonSchema as Record<string, unknown>
  return jsonSchemaToType(rest as Parameters<typeof jsonSchemaToType>[0]) as unknown as Type
}
