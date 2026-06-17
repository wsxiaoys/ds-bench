# Metadata-Filtered Context Search with the Alchemyst TypeScript SDK

## Background
Alchemyst AI is a Context Engine that lets you tag stored documents with `group_name` metadata so you can later run filtered semantic searches that only return chunks from the requested group(s). The TypeScript SDK has a well-known asymmetry that trips developers up: when storing a document you tag it with `group_name` (snake_case) inside `metadata`, but when searching you must filter with `groupName` (camelCase) inside `metadata`. Mixing these up silently returns the wrong (or no) results.

Your task is to build a small, rerunnable Node.js CLI in TypeScript that exercises this end-to-end against the real Alchemyst API.

## Requirements
- Build a Node.js + TypeScript project that uses the official `@alchemystai/sdk` package.
- The CLI must read the API key from the `ALCHEMYST_AI_API_KEY` environment variable (do not hardcode it) and the run id from the `ZEALT_RUN_ID` environment variable.
- The CLI must seed (idempotently, so it can be re-run without errors) four resource documents into Alchemyst with distinct `file_name`s and `group_name`s:
  - Two documents tagged with `group_name: ["support"]`.
  - Two documents tagged with `group_name: ["engineering"]`.
- All four `file_name` values must be suffixed with the current `run-id` so concurrent runs do not collide.
- After seeding, the CLI must perform a metadata-filtered context search using the group passed on the command line and print the resulting file_names as a JSON array on stdout.
- The CLI must accept the group via `--group <group_name>` (e.g. `--group support` or `--group engineering`).
- No mocks or fakes: the task must talk to the real Alchemyst API.

## Implementation Hints
- Install `@alchemystai/sdk` and a TypeScript toolchain. Compile to `dist/` and run with `node dist/main.js`.
- Initialize the SDK with `new AlchemystAI({ apiKey: process.env.ALCHEMYST_AI_API_KEY })`.
- Store documents with `client.v1.context.add({ documents: [...], context_type: 'resource', source: 'docs', scope: 'internal' })`, putting `file_name` and `group_name` (snake_case) under each document's `metadata`.
- Search with `client.v1.context.search({ query, scope: 'internal', metadata: { groupName: [<group>] } })` — note the camelCase `groupName` on search. This asymmetry is the whole point of the task.
- Because `file_name`s must be unique, attempting to re-add an existing `file_name` returns a 409 conflict. Make the seeding step idempotent so re-running the CLI does not crash.
- The search returns chunks (`contexts`), each carrying its source document's metadata. Deduplicate by `file_name` and emit a single JSON array of strings.
- For the TypeScript SDK details and the `group_name`/`groupName` asymmetry, see https://getalchemystai.com/docs/getting-started/quickstart and https://getalchemystai.com/docs/tutorials/typescript-agent.md.

## Acceptance Criteria
- Project path: /home/user/myproject
- Command: `node dist/main.js --group <group_name>`
- Input argument format: `--group <group_name>` where `<group_name>` is one of `support` or `engineering`.
- The compiled output must exist at `/home/user/myproject/dist/main.js` after building.
- The CLI must read `ALCHEMYST_AI_API_KEY` and `ZEALT_RUN_ID` from environment variables.
- The CLI must seed four documents (two in `support`, two in `engineering`), with each `file_name` suffixed by the current `run-id`. Seeding must be idempotent across reruns.
- The CLI must perform a real metadata-filtered search via `client.v1.context.search` using `metadata: { groupName: [<group>] }` (camelCase).
- The stdout of the CLI must be a single JSON array of strings (the deduplicated `file_name`s returned by the filtered search) and nothing else on the final line. Logs may be printed to stderr.
- When filtering by a given group, only documents whose stored `group_name` includes that group must appear in the JSON array.

