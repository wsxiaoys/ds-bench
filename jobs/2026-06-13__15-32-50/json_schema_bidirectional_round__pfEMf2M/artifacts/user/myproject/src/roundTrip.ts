import { type, type Type } from "arktype"
import { jsonSchemaToType } from "@ark/json-schema"

// Monkeypatch type.enumerated to fix the @ark/json-schema enum parsing bug.
// We patch BOTH the top-level arktype and the nested one if present.
function patchEnumerated(typeObj: any) {
  if (typeObj && typeof typeObj.enumerated === "function" && !typeObj.enumerated.__patched) {
    const original = typeObj.enumerated
    typeObj.enumerated = function (this: any, ...args: any[]) {
      if (args.length === 1 && Array.isArray(args[0])) {
        return original.apply(this, args[0])
      }
      return original.apply(this, args)
    }
    typeObj.enumerated.__patched = true
  }
}

// Patch the top-level type
patchEnumerated(type)

// Try to patch the nested type inside @ark/json-schema's node_modules
try {
  const nestedModule = await import(
    // @ts-ignore
    "../node_modules/@ark/json-schema/node_modules/arktype/out/index.js"
  )
  if (nestedModule && nestedModule.type) {
    patchEnumerated(nestedModule.type)
  }
} catch (e) {
  // If it's not nested or failed to import, ignore
}

/**
 * Implement the bidirectional ArkType <-> JSON Schema round trip.
 *
 * `roundTrip(schema)` MUST:
 *   1. Export `schema` to JSON Schema (draft-2020-12) via `schema.toJsonSchema()`.
 *   2. Re-parse the resulting JSON Schema back into an ArkType `Type` using
 *      `@ark/json-schema`.
 *   3. Return the re-parsed Type.
 */
export function roundTrip(schema: Type): Type {
  const jsonSchema = exportJsonSchema(schema)
  return jsonSchemaToType(jsonSchema) as unknown as Type
}

/**
 * Implement the JSON Schema export used as the round-trip intermediate.
 * The returned object MUST contain `$schema` set to the draft-2020-12 URI:
 *   https://json-schema.org/draft/2020-12/schema
 */
export function exportJsonSchema(schema: Type): object {
  const jsonSchema = schema.toJsonSchema()
  if (!jsonSchema || typeof jsonSchema !== "object") {
    throw new Error("toJsonSchema did not return a valid object")
  }
  return {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    ...jsonSchema,
  }
}
