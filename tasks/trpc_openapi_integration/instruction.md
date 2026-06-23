# Generate OpenAPI Specification from tRPC Router

## Background
You are working on a Node.js project that uses tRPC v11 for its backend API. The team needs to expose an OpenAPI specification to integrate with third-party tools (like Swagger UI or Postman) without maintaining a separate schema. You will use the official `@trpc/openapi` package to generate an OpenAPI 3.1 document directly from the existing tRPC router.

## Requirements
- Install the official `@trpc/openapi` package.
- Create a script that generates an OpenAPI document from the existing `appRouter` defined in `src/server/router.ts`.
- The generated OpenAPI document must have the title `My API` and version `1.0.0`.
- The script must write the resulting OpenAPI JSON to a file named `openapi.json` in the root of the project.

## Implementation Guide
1. Navigate to the project directory `/home/user/project`.
2. Install the required package: `npm install @trpc/openapi@next` (or the appropriate alpha version for v11).
3. Create a file `generate-openapi.ts` in the project root.
4. In `generate-openapi.ts`, use `generateOpenAPIDocument` from `@trpc/openapi` to parse `./src/server/router.ts`.
5. Write the generated document to `openapi.json` using Node.js `fs` module.
6. Run the script using `npx tsx generate-openapi.ts`.

## Constraints
- Project path: `/home/user/project`
- The generated file must be exactly at `/home/user/project/openapi.json`.
- Do not modify the existing `src/server/router.ts` file.
- Use the programmatic API of `@trpc/openapi`.