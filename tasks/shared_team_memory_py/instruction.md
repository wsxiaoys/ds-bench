# Shared Team Memory with Alchemyst AI (Python)

## Background
Alchemyst AI provides a "Context Engine" that can act as persistent memory for AI agents. A common collaboration pattern is to let multiple users contribute to the **same** `session_id` so that everyone shares a common context (e.g., a team standup, a support ticket thread, or a multi-user chat). In this task you will build a small Python CLI that simulates two teammates, **alice** and **bob**, who participate in the **same** session and add their own memory entries. The CLI must then prove that the shared session can be recalled by either teammate via Alchemyst's memory retrieval.

## Requirements
- Use the official Python SDK package `alchemystai` (>= 0.10.0).
- The API key MUST be read from the `ALCHEMYST_AI_API_KEY` environment variable. Never hardcode the key, never use mocks, and never stub the SDK.
- Read the current run id from the `ZEALT_RUN_ID` environment variable and derive the following identifiers from it:
  - Shared session id: `session-${ZEALT_RUN_ID}`
  - Alice's user id: `alice-${ZEALT_RUN_ID}`
  - Bob's user id: `bob-${ZEALT_RUN_ID}`
- The CLI must seed two memory entries into the shared session (one for Alice, one for Bob) so that the session contains both contributions before retrieval. Seeding MUST be idempotent so the CLI can be re-run safely.
  - Alice's memory content MUST include the phrase: `Alice prefers Python for data processing pipelines`
  - Bob's memory content MUST include the phrase: `Bob recommends PostgreSQL with TimescaleDB for time-series storage`
- The CLI must then perform a memory retrieval scoped to the shared session and print the retrieved snippets so we can verify both teammates' contributions are recoverable by either user.

## Implementation Hints
- Install the SDK with `pip install alchemystai` and instantiate it as `AlchemystAI(api_key=os.environ["ALCHEMYST_AI_API_KEY"])`.
- Memory entries are written with `client.v1.context.memory.add(user_id=..., session_id=..., contents=[{"content": ...}])` (consult the Python SDK reference for the exact argument names — note that some docs use `content` while v0.10.0 expects a list of `contents`).
- **CRITICAL — Python SDK v0.10.0 caveat:** `client.v1.context.memory.search` does **NOT** exist in `alchemystai==0.10.0`. The public TypeScript SDK and the marketing docs reference it, but it is not exposed in Python. You MUST consult the authoritative v0.10.0 API reference at https://raw.githubusercontent.com/Alchemyst-ai/alchemyst-sdk-python/refs/tags/v0.10.0/api.md and use the actual retrieval method that is available (e.g., `client.v1.context.search` with filters that scope the result to the shared session, plus a query string). Do not invent a `memory.search` method; the import / attribute access will fail.
- The Alchemyst memory store is indexed shortly after writes — be prepared to retry the retrieval a few times before printing the final output.
- Argparse is the simplest way to parse `--user-id` and `--query`.
- Reference docs:
  - https://getalchemystai.com/docs/tutorials/python-agent.md
  - https://getalchemystai.com/docs/getting-started/quickstart-memory
  - https://raw.githubusercontent.com/Alchemyst-ai/alchemyst-sdk-python/refs/tags/v0.10.0/api.md

## Acceptance Criteria
- Project path: /home/user/myproject
- The CLI entrypoint is `main.py` inside the project path.
- Command: `python3 main.py --user-id <user-id> --query <query>`
  - `--user-id` is the calling teammate's user id. It MUST accept either `alice-${ZEALT_RUN_ID}` or `bob-${ZEALT_RUN_ID}`.
  - `--query` is a free-form natural-language string used for the retrieval call.
- On every invocation, the CLI MUST:
  1. Ensure both Alice's and Bob's memory entries exist in the shared session `session-${ZEALT_RUN_ID}` (idempotent seeding is acceptable).
  2. Retrieve the shared session's context from the Alchemyst memory store and print results to STDOUT.
- STDOUT format requirements:
  - Print exactly one header line in the form `USER: <user-id>`.
  - Print exactly one header line in the form `SESSION: session-<run-id>`.
  - Print a line `RETRIEVED:` followed by one or more lines starting with `- ` containing snippet text. Each retrieved snippet must be on its own line.
  - The retrieved snippets MUST collectively contain BOTH of the seeded phrases (the Alice phrase AND the Bob phrase) so that either user can verify the other's contribution is visible.
- Exit code MUST be `0` on success.
- The CLI MUST exit with a non-zero code if `ALCHEMYST_AI_API_KEY` or `ZEALT_RUN_ID` is missing.

