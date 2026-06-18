# Namespaced Schema Module (ArkType Submodules)

## Background
You are wiring up a tiny request-validation layer for a back-office service using `arktype@2.2.0`. The product team wants the internal data model (`db.*`) and the public API shapes (`api.*`) grouped under their own namespaces inside a single shared schema module so that other parts of the codebase can reach `module.db.User`, `module.api.CreateUserRequest`, etc. without juggling multiple imports. A small CLI uses the module to validate incoming JSON payloads.

## Requirements
- The project lives at `/home/user/myproject`. `arktype@2.2.0` and `tsx` are preinstalled, and `tsconfig.json` is preconfigured with `module: NodeNext` / `moduleResolution: NodeNext`.
- Build a namespaced schema module in `src/schema.ts` that defines all four of the following submodule aliases inside a SINGLE `scope({...})` call (do NOT create separate scopes for `db` and `api`):
  * `db.User`: `id` is a UUID string, `name` is a string whose length is between 1 and 50 inclusive, `orgId` is a UUID string.
  * `db.Org`: `id` is a UUID string, `name` is a string whose length is between 1 and 100 inclusive.
  * `api.CreateUserRequest`: `user` references the `db.User` submodule alias, `token` is a string whose length is between 32 and 256 inclusive.
  * `api.CreateOrgRequest`: `org` references the `db.Org` submodule alias, `adminUserId` is a UUID string.
- The `api.*` types MUST reference the `db.*` types through string-embedded aliases (e.g. by using `"db.User"` as the type definition), not by inlining the object shape again.
- Export the resulting module from `src/schema.ts` (the consumer must be able to import it and reach `module.api.CreateUserRequest` and `module.db.User` as independent `Type`s via dot access).
- Build a CLI entrypoint at `cli.ts` that reads ONE JSON object from stdin. The object has the shape `{"kind": "createUser" | "createOrg", "payload": <object>}`. The CLI must pick the matching `api.*` `Type` from the schema module and validate `payload`.
  * On success: print `VALID` on one line, then print the JSON-stringified validated payload on the next line.
  * On failure (validation error, unknown `kind`, malformed JSON, missing fields, etc.): print a single line that starts with `INVALID:` followed by a space and a short error description.
  * The CLI MUST exit with code `0` in BOTH cases.

## Implementation Hints
- Use ArkType's `scope` primitive to define the four aliases together. Reach for the submodule-key feature so that `db` and `api` become nested namespaces on the exported module.
- Use ArkType's built-in string keywords for UUIDs and string-length constraints rather than writing custom regex.
- Run the CLI under `tsx`; no compile step is required.

## Acceptance Criteria
- Project path: `/home/user/myproject`
- Schema module file: `/home/user/myproject/src/schema.ts`
- CLI entrypoint: `/home/user/myproject/cli.ts`
- Command: `npx --no-install tsx cli.ts`
- Input: ONE JSON object on stdin with the shape `{"kind": "createUser" | "createOrg", "payload": <object>}`.
- Output (stdout):
  * Valid payload: line 1 is exactly `VALID`; line 2 is the JSON-stringified validated payload.
  * Invalid payload (or invalid `kind`, malformed JSON, etc.): a single line starting with `INVALID:` followed by a space and an error description.
- The CLI MUST exit with code `0` whether the payload is accepted or rejected.
- `src/schema.ts` MUST contain the dot-namespaced submodule keys `db.User`, `db.Org`, `api.CreateUserRequest`, and `api.CreateOrgRequest` defined inside a single `scope({...})` call, and the `api.*` aliases MUST reference the `db.*` aliases by string name (no inlined duplicate object shapes).

