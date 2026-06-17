# Shared Team Memory CLI with Alchemyst AI (TypeScript)

## Background
Alchemyst AI is an AI Context Engine that, among other things, provides cross-session memory primitives bound to a `userId` and `sessionId`. A particularly useful pattern is **shared team memory**: multiple distinct users contribute to the **same** `sessionId` so that any team member can later recall the **full conversation thread**, regardless of who wrote which entry. This is the foundation for collaborative agents, group standups, team support bots, and shared planning assistants.

In this task you will build a small TypeScript CLI that simulates two teammates (`alice` and `bob`) collaborating in one shared session. Each invocation either **stores** a memory or **searches** the shared memory pool. The CLI must use the official `@alchemystai/sdk` package and target the real Alchemyst AI API — no mocks, no stubs, no hardcoded responses.

The CLI proves correctness of shared memory by allowing one user to read back content that was added by the other user.

## Requirements
- Implement a Node.js TypeScript CLI under `/home/user/myproject` that:
  - Uses the official `@alchemystai/sdk` package.
  - Authenticates with `ALCHEMYST_AI_API_KEY` from the environment.
  - Derives a shared `sessionId` from the `ZEALT_RUN_ID` environment variable, namespaced so it cannot collide with other parallel runs.
  - Accepts a required `--user-id <id>` flag (used as the Alchemyst memory `userId`).
  - Accepts exactly one of the following operation flags per invocation:
    - `--add "<content>"` — store a new memory under the given `userId` and the shared `sessionId` using `client.v1.context.memory.add(...)`.
    - `--query "<query>"` — search shared memory using `client.v1.context.memory.search(...)` with the given `userId` and the shared `sessionId`, and print every recovered memory.
  - If `--user-id` is missing, the CLI must fail with a non-zero exit code and emit a message that includes the string `MISSING_PARAMETERS` (the same error code Alchemyst returns when `userId` or `sessionId` are absent) so the caller knows both `userId` and `sessionId` are mandatory for memory operations.
  - On `--add` success, print a single confirmation line of the form `ADDED: <content>` to stdout.
  - On `--query`, print every memory returned by Alchemyst, one per line, in the exact format `MEMORY: <content>`. The CLI must surface the contents of all memories that the SDK returns (including those that were added by a different `userId` in the same session).
  - Configure search with a low/lenient similarity threshold so semantically related entries are reliably retrieved.

- Provide a complete, build-able project:
  - `package.json` with a `build` script that produces a runnable bundle/entry at `dist/main.js`.
  - `tsconfig.json` configured to emit JavaScript that Node.js v24 can execute directly via `node dist/main.js ...`.
  - All dependencies declared in `package.json` (no global installs).

## Implementation Hints
- The TypeScript SDK exposes memory operations under `client.v1.context.memory.add({ userId, sessionId, content })` and `client.v1.context.memory.search({ userId, sessionId, ... })`. See the [Memory quickstart](https://getalchemystai.com/docs/getting-started/quickstart-memory) and the [TypeScript SDK guide](https://getalchemystai.com/docs/tutorials/typescript-agent.md).
- Both `userId` and `sessionId` are mandatory; omitting either yields `MISSING_PARAMETERS` from the API. Validate `--user-id` locally before calling the SDK so the CLI fails fast with the same error code surface.
- To avoid cross-run collisions when multiple evaluations run in parallel, build the shared `sessionId` as something like `team-standup-${ZEALT_RUN_ID}` (read `ZEALT_RUN_ID` from `process.env`). All invocations within a single run must use the same derived `sessionId`.
- Memory entries added by different `userId` values that share the same `sessionId` form one common thread; either user can recall the other's contributions via search.
- Use a permissive `similarity_threshold` / `minimum_similarity_threshold` (e.g. around `0.1`–`0.3`) so semantically loose queries still retrieve the stored entries.
- Iterate over the returned `memories` array and print each entry's textual content prefixed with `MEMORY: ` on its own line so it is trivially greppable.
- Do not hardcode `userId`, `sessionId`, or memory content — they all come from CLI args / environment variables.
- Use any standard CLI argument parser of your choice (or a manual `process.argv` walk).

## Acceptance Criteria
- Project path: `/home/user/myproject`
- The project builds successfully with `npm install && npm run build` and produces `/home/user/myproject/dist/main.js`.
- Command: `node dist/main.js --user-id <id> --query "<query>"`
  - Reads `ALCHEMYST_AI_API_KEY` and `ZEALT_RUN_ID` from the environment.
  - Prints zero or more lines, each in the format `MEMORY: <content>`.
  - Exit code is `0` on success.
- Command: `node dist/main.js --user-id <id> --add "<content>"`
  - Stores the memory in Alchemyst under the given `userId` and the shared `sessionId` derived from `ZEALT_RUN_ID`.
  - Prints exactly one line in the format `ADDED: <content>` on success.
  - Exit code is `0` on success.
- Command: `node dist/main.js --query "<query>"` (no `--user-id`)
  - Exits with a non-zero exit code.
  - Combined stdout/stderr contains the substring `MISSING_PARAMETERS`.
- Shared session semantics: when two different `--user-id` values are used with the same `ZEALT_RUN_ID`, each user's `--query` invocation must be able to surface memories that were added by the other user (i.e. the `MEMORY: ...` lines emitted include the other user's content).
- The CLI must use the real Alchemyst AI service via `@alchemystai/sdk`; mocking or hardcoding memory contents is not allowed.

