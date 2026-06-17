# Convex Data Validation

## Background
Convex provides strong runtime validation using a code-first schema. This ensures that all data inserted into your database matches the expected types and structure.

## Requirements
- Initialize a Convex project in `/home/user/project`.
- Read the `ZEALT_RUN_ID` environment variable. Replace any hyphens in the `run-id` with underscores to create a safe suffix (e.g., if `run-id` is `zr-123`, the suffix is `zr_123`).
- Define a schema for a table named `products_<suffix>` with the following fields:
  - `name` (string)
  - `price` (number)
  - `inStock` (boolean)
- Create a mutation named `create` in `convex/products_<suffix>.ts` that takes `name`, `price`, and `inStock` as arguments and inserts a new document into the `products_<suffix>` table.
- Deploy the project to the Convex cloud using the deployment key.

## Implementation Hints
- Read the `ZEALT_RUN_ID` environment variable to determine the table and file names.
- Use `defineSchema` and `defineTable` from `convex/server` to define the schema in `convex/schema.ts`.
- Use `v.string()`, `v.number()`, and `v.boolean()` from `convex/values` for field types.
- Ensure the mutation arguments are also validated using the same `v` validators.
- Use `npx convex deploy` to push your code and schema to the cloud. The CLI will automatically use the `CONVEX_DEPLOY_KEY` environment variable.

## Acceptance Criteria
- Project path: /home/user/project
- Ensure the real deployment action is executed and the Convex cloud is updated.
- Log file: /home/user/project/deploy.log
- The log file must exist and contain the deployment output.
- The `products_<suffix>:create` mutation must be available in the Convex cloud and enforce strict schema validation on the `products_<suffix>` table.

