# Async Folder Parsing with LlamaCloud (TypeScript)

## Background
Your team needs a small TypeScript utility that ingests every PDF in a folder and turns each one into a clean markdown document. Throughput matters, but the LlamaCloud Parse API has per-account rate limits, so the script must process files concurrently with a strict cap on parallel jobs. The official LlamaCloud Node.js SDK (`@llamaindex/llama-cloud`, v2.x) exposes an async-by-default client that pairs well with `Promise.all` plus a small concurrency limiter.

A starter project already exists at `/home/user/myproject` with three sample PDFs in `./inputs/`. Your job is to fill in the parse script, run it, and produce the required artifacts.

## Requirements
- Implement a TypeScript script that processes **every** `.pdf` file under `./inputs/` using the LlamaCloud Parse SDK (`@llamaindex/llama-cloud`).
- Concurrency is capped: **no more than 2** parse jobs may be in flight at the same time. Use a semaphore, `p-limit`, or an equivalent technique — never call all jobs in parallel without a cap.
- Use Parse tier `cost_effective` with version `latest`, and request `expand: ["markdown"]`.
- When uploading each file, tag the upload with an `external_file_id` so concurrent test runs do not collide. Build the tag as `${ZEALT_RUN_ID}-<pdf_basename>` (e.g., `zr-abc123-attention`).
- For each parsed PDF, write the concatenated markdown of every page (joined by `\n\n---\n\n`) to `./outputs/<pdf_basename>.md`.
- Write a human-readable log to `./output.log`. The log must contain exactly one summary line per processed PDF in this format (one per line, in any order):
  - `Parsed: <pdf_basename>.pdf | pages: <N>` where `<N>` is the integer page count returned by the SDK.
- The script must finish with exit code 0 when every input PDF was parsed successfully.

## Implementation Hints
- Install `@llamaindex/llama-cloud` and a small concurrency helper (e.g., `p-limit`) plus `tsx` to run TypeScript without a build step.
- The Parse SDK call you want is `client.parsing.parse({ file_id, tier, version, expand })`; it polls until completion and returns the result. Use `client.files.create({ file: fs.createReadStream(...), purpose: "parse", external_file_id })` to upload.
- The number of pages is the length of `result.markdown.pages`; each page object has a `markdown` field.
- Read the run id from the `ZEALT_RUN_ID` environment variable and use it in the `external_file_id` tag. Read the API key from `LLAMA_CLOUD_API_KEY` (the SDK does this automatically).
- Make sure `./outputs/` exists before writing files.

## Acceptance Criteria
- Project path: `/home/user/myproject`
- Ensure the script is executed against the real LlamaCloud Parse API and that the artifacts exist on disk after execution.
- Log file: `/home/user/myproject/output.log`
- The directory `/home/user/myproject/outputs/` must contain one `.md` file per input PDF (matching the input basenames), and each `.md` file must be non-empty.
- The log file must contain exactly one line per input PDF in the format `Parsed: <pdf_basename>.pdf | pages: <N>`, where `<N>` is a positive integer.
- Each uploaded LlamaCloud file must carry an `external_file_id` that starts with the current `${ZEALT_RUN_ID}-` prefix.

