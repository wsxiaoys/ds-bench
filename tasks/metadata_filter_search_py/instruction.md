# Alchemyst AI Metadata Filter Search (Python)

## Background
You are building a Python CLI utility that demonstrates how to organize documents by team (e.g., `support`, `billing`, `engineering`) inside the Alchemyst AI Context Engine, and then retrieve only the documents belonging to a single team using metadata-based search filtering. This pattern is widely used to scope retrieval to a particular knowledge domain.

The CLI uses the official Python SDK [`alchemystai`](https://pypi.org/project/alchemystai/) (v0.10.0). For the exact, authoritative method signatures, consult the [Python API Reference](https://raw.githubusercontent.com/Alchemyst-ai/alchemyst-sdk-python/refs/tags/v0.10.0/api.md). The metadata filter syntax for search differs between SDKs; review the [Quickstart 'Organize with Metadata' section](https://getalchemystai.com/docs/getting-started/quickstart#advanced-organize-with-metadata) to confirm the Python parameter name.

## Requirements
- Implement a single-file Python CLI at `/home/user/myproject/main.py`.
- On every invocation, seed the Alchemyst AI Context Engine with documents that belong to three distinct groups: `support`, `billing`, and `engineering`. At least two documents per group must be added.
- Each document must carry `metadata.file_name` and `metadata.group_name` so it can be retrieved by team.
- Accept a `--group` flag whose value is one of `support`, `billing`, or `engineering`, and perform a context search restricted to that group only.
- Print the result to stdout as a single JSON array of the `file_name` values returned by the search, with no other content on stdout.
- The CLI must be idempotent: re-running it must not fail with `409 Conflict` errors caused by duplicate `file_name` values.

## Implementation Hints
- Read `ALCHEMYST_AI_API_KEY` from the environment and use it to construct the `AlchemystAI` client.
- Read `ZEALT_RUN_ID` from the environment and incorporate it into every `file_name` you store so concurrent runs (and reruns) do not collide.
- For the Python SDK, use the `metadata` parameter of `client.v1.context.search(...)` with `group_name` (snake_case) to filter by group. The TypeScript SDK uses `groupName`; do **not** copy that here.
- When `client.v1.context.search(...)` returns, dedupe `file_name` values across the returned chunks before printing, because longer documents may yield multiple chunks.
- Use `argparse` (or any standard CLI parser) to parse `--group`.
- Use only the official Python SDK; do not call the REST API directly and do not mock the service.

## Acceptance Criteria
- Project path: /home/user/myproject
- Command: `python3 main.py --group <group_name>`
- Input argument: `--group <group_name>` where `<group_name>` is one of `support`, `billing`, `engineering`.
- Output format: stdout must contain a single JSON array (parsable by `json.loads`) whose elements are the `file_name` values of the documents stored for the requested group. Order is not significant.
- File names must be namespaced with the `ZEALT_RUN_ID` environment variable so the CLI is safe to rerun and safe to run concurrently.
- The CLI must call the real Alchemyst AI API using the Python SDK (`alchemystai`); the `ALCHEMYST_AI_API_KEY` environment variable must be honored.
- When filtering by one group, the returned `file_name` set must contain only the documents that were stored under that group and must not contain documents stored under the other two groups.

