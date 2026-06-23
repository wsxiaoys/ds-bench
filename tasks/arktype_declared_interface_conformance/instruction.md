# Declared Interface Conformance with ArkType

## Goal
In the project at `/home/user/myproject`, wire two ArkType schemas to the pre-existing TypeScript `interface Product` (in `types.ts`) using `type.declare`. One schema must be valid; the other must be intentionally broken so that the TypeScript compiler rejects it.

## Acceptance Criteria
- Project path: `/home/user/myproject`
- The existing `interface Product { id: string; sku: string; price: number; tags: string[] }` in `/home/user/myproject/types.ts` MUST NOT be modified.
- Create `/home/user/myproject/schema.ts` that:
  - Imports `Product` from `./types`.
  - Defines an ArkType schema using the exact call form `type.declare<Product>()({...})`.
  - Default-exports that schema (so it can be imported via `import productSchema from "./schema"`).
- Create `/home/user/myproject/broken.ts` containing a second schema authored with `type.declare<Product>()({...})` that intentionally omits the `tags` property. This file MUST be kept out of the main `tsconfig.json` `include` set so the project still type-checks.
- Command: `cd /home/user/myproject && npm run validate`
  - MUST exit with status 0.
  - MUST print a line of the form `Validated product: <id>` to stdout, where `<id>` is the `id` of a sample `Product` payload validated at runtime through the schema in `schema.ts`.
- Command: `cd /home/user/myproject && npx tsc --noEmit`
  - MUST exit with status 0.
- Command: `cd /home/user/myproject && npx tsc --noEmit --strict --target ES2022 --module ESNext --moduleResolution Bundler --esModuleInterop --skipLibCheck broken.ts`
  - MUST exit with a non-zero status (TypeScript must reject the broken schema because it does not conform to `Product`).

