# Declared Interface Conformance with ArkType

## Goal
In the project at `/home/user/myproject`, wire two ArkType schemas to the pre-existing TypeScript `interface Product` (in `types.ts`) using `type.declare`. One schema must be valid; the other must be intentionally broken so that the TypeScript compiler rejects it.

## Implementation Details
- The existing `interface Product { id: string; sku: string; price: number; tags: string[] }` in `types.ts` MUST NOT be modified.
- Create `schema.ts` that:
  - Imports `Product` from `./types`.
  - Defines an ArkType schema using the exact call form `type.declare<Product>()({...})`.
  - Default-exports that schema (so it can be imported via `import productSchema from "./schema"`).
- Create `broken.ts` containing a second schema authored with `type.declare<Product>()({...})` that intentionally omits the `tags` property. This file MUST be kept out of the main `tsconfig.json` `include` set so the project still type-checks.
- When running `npm run validate`, it MUST print a line of the form `Validated product: <id>` to stdout, where `<id>` is the `id` of a sample `Product` payload validated at runtime through the schema in `schema.ts`.

