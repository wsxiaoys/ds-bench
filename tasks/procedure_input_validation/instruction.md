# tRPC v11 Procedure Input Validation

## Background
tRPC v11 uses TypeScript and libraries like Zod for end-to-end typesafe input validation. You need to add a new mutation with complex input validation to an existing tRPC router.

## Requirements
- Open the existing tRPC router in `/home/user/project/router.ts`.
- Add a new mutation named `registerUser` to the `appRouter`.
- The mutation must accept an input object with the following fields validated by Zod:
  - `username`: A string with a minimum length of 3 characters.
  - `email`: A valid email string.
  - `password`: A string with a minimum length of 8 characters.
- The mutation's resolver should return an object: `{ success: true, user: { username, email } }` (omitting the password).

## Implementation Guide
1. Modify `/home/user/project/router.ts`.
2. Import `z` from `zod`.
3. Use `publicProcedure.input(...)` to define the schema.
4. Implement the `.mutation(...)` resolver to return the expected object.

## Constraints
- Project path: `/home/user/project`
- The project is a Node.js project using TypeScript.
- Do not modify the existing `hello` query in the router.