# Alchemyst AI Threshold Sensitivity CLI (TypeScript)

## Background
When building RAG pipelines on top of Alchemyst AI, developers must pick a `similarity_threshold` for `v1.context.search`. According to the Alchemyst documentation, lower thresholds (e.g. 0.5) return more results (higher recall, lower precision) while higher thresholds (e.g. 0.9) return only highly relevant chunks (lower recall, higher precision). This task evaluates the agent's ability to build a small Node.js + TypeScript CLI that demonstrates this threshold sensitivity empirically.

Reference documentation (the agent SHOULD consult these before implementing):
- TypeScript SDK tutorial: https://getalchemystai.com/docs/tutorials/typescript-agent.md
- Contextual AI Quickstart: https://getalchemystai.com/docs/getting-started/quickstart.md
- Troubleshooting (409 conflicts, rate limits): https://getalchemystai.com/docs/advanced/troubleshooting.md
- Docs index: https://getalchemystai.com/docs/llms.txt

## Requirements
- The project path is `/home/user/myproject`. Implement a Node.js + TypeScript CLI that can be run with `node dist/main.js --thresholds <csv>`, where `--thresholds` accepts a comma-separated list of `similarity_threshold` values (e.g. `0.5,0.7,0.9`) in the range `[0, 1]`.
- The CLI must read the API key from the `ALCHEMYST_AI_API_KEY` environment variable. Do not hardcode credentials. It must fail with a non-zero exit code if the key is not set.
- The CLI must ingest a small corpus of documents with varied semantic relevance to a fixed query (a few clearly on-topic documents, a few tangentially related, and a few clearly off-topic).
- To demonstrate threshold sensitivity, the corpus must be designed such that running the CLI with `--thresholds 0.5,0.7,0.9` returns at least one matching context at `0.5`, and the count at `0.5` must strictly exceed the count at `0.9` (and the counts must be monotonically non-increasing as the threshold increases).
- All ingested documents must use `file_name` values that include the current `run-id` (read from `/logs/artifacts/run-id`) so that concurrent runs do not collide on `file_name`.
- The CLI must be idempotent: re-running it multiple times in the same environment with the same run-id must continue to succeed without crashing on 409 conflicts.
- For each threshold, the CLI must invoke `client.v1.context.search` with the same fixed query and the given `similarity_threshold`, then count the number of returned `contexts`.
- The CLI must print exactly one JSON object to stdout. Other diagnostic logging or debug messages may be written to stderr but must not appear on stdout. The JSON object must conform to this schema:

  ```json
  {
    "query": "<string>",
    "results": [
      { "threshold": <number>, "count": <integer> }
    ]
  }
  ```

  - `results` must contain one entry per requested threshold, in the same order as the `--thresholds` CLI argument.
  - Each `threshold` value must equal one of the values passed via `--thresholds` (numeric equality, tolerant to standard float formatting).
  - Each `count` must be a non-negative integer equal to the number of contexts returned by `v1.context.search` at that threshold.
- The command must exit with status code `0` on success and a non-zero code on failure.

## Implementation Hints
- Initialize the SDK with `new AlchemystAI({ apiKey: process.env.ALCHEMYST_AI_API_KEY })`.
- Build a corpus where some documents are clearly about the query topic and others are unrelated. A larger spread of relevance makes the threshold effect more visible.
- Use unique, deterministic `file_name` values that include the `/logs/artifacts/run-id`, e.g. `threshold_doc_<idx>_<run-id>.md`, so the corpus is stable across re-runs and isolated per run.
- Handle ingestion idempotently: if the API returns a 409 Conflict because the documents are already stored, treat it as success and proceed to the search phase.
- When invoking `v1.context.search`, pass the same `query` string and `scope` for every threshold; only the `similarity_threshold` value changes.
- Compile TypeScript to JavaScript so the project can be run with `node dist/main.js ...`.

