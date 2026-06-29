# Alchemyst AI Basic RAG Flow (Python)

## Background
Alchemyst AI is a Context Engine that ingests documents and supports semantic retrieval. You will build a small Python CLI that demonstrates the most fundamental RAG flow with the official `alchemystai` Python SDK: ingest a single policy document into the Alchemyst context engine, then search the context engine to retrieve chunks that are relevant to a user question.

The Python SDK is published as `alchemystai` and is initialized with `AlchemystAI(api_key=...)`. The API surface for Python v0.10.0 is documented at https://raw.githubusercontent.com/Alchemyst-ai/alchemyst-sdk-python/refs/tags/v0.10.0/api.md and the conceptual guide is at https://getalchemystai.com/docs/getting-started/quickstart. **You SHOULD check the v0.10.0 API reference before coding** because some methods that exist in the TypeScript SDK (for example `memory.search`) are not available in the Python SDK.

## Requirements
- Build a Python CLI at `/home/user/myproject/main.py` that accepts a single `--question <text>` argument.
- On every invocation the program must:
  1. Add a single policy document about a 30-day refund policy to the Alchemyst context engine via `client.v1.context.add(...)`.
  2. Search the context engine for the user's question via `client.v1.context.search(...)` and print the retrieved chunks to stdout.
- The `ALCHEMYST_AI_API_KEY` value MUST be read from the environment variable of the same name.
- The program MUST also read the `/logs/artifacts/run-id` and incorporate it into the document's `file_name` metadata so concurrent runs do not collide (a 409 Conflict otherwise).

## Implementation Hints
- Install the SDK with `pip3 install alchemystai` (the import path is `alchemyst_ai`).
- Initialize the client with `AlchemystAI(api_key=os.environ["ALCHEMYST_AI_API_KEY"])`.
- When calling `context.add`, set `context_type="resource"`, `source="documentation"`, and `scope="internal"`. Make the document `file_name` unique by suffixing it with the `/logs/artifacts/run-id` value (for example `refunds-<run-id>.md`).
- When calling `context.search`, use the same `scope="internal"` and a `similarity_threshold` around `0.5`-`0.7`. The result object exposes a `contexts` attribute (a list); each element exposes a `content` attribute.
- Print each retrieved chunk's `content` to stdout so it can be inspected by the verifier. If no contexts are returned, print a clear message.
- Use `python3` (not `python`).

