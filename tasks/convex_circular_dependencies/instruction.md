# Resolve Circular Dependencies in Convex Generated Code

## Background
Convex automatically generates TypeScript types in the `convex/_generated/api.ts` file. In projects with many cross-file function calls, importing the `api` object from `_generated/api` to call other functions can create import cycles. This triggers TypeScript circularity limits and causes compilation errors like "Type instantiation is excessively deep and possibly infinite" or "circular reference" errors.

## Requirements
- The provided Convex project in `/home/user/project` currently fails to compile due to circular dependencies between `convex/a.ts`, `convex/b.ts`, and `convex/c.ts`.
- You must resolve the circular dependencies so that the project compiles successfully (verifiable by running `npm run typecheck` which must exit with code 0).
- The files `convex/a.ts`, `convex/b.ts`, and `convex/c.ts` must still export `funcA`, `funcB`, and `funcC` respectively as Convex queries using the exact declaration syntax (e.g., `export const funcA = query`).

## Implementation Hints
- Instead of importing `api` from `_generated/api` in your function files, consider using `anyApi` from `convex/server` to break the type cycle.
- Alternatively, you can extract the shared logic into helper functions in separate files that do not import the generated `api`.
- Run `npm run typecheck` to verify if the TypeScript errors are resolved.

