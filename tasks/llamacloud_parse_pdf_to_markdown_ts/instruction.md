# Parse a PDF to Markdown with the LlamaCloud TypeScript SDK

## Background
LlamaCloud's Parse product is an agentic OCR / layout-aware document parser that turns PDFs (and 130+ other file types) into clean markdown, text, JSON, and more. It is part of the LlamaCloud (LlamaParse) platform and is consumed through the `@llamaindex/llama-cloud` Node.js SDK (v2+).

Your job is to write a small TypeScript program that uploads a sample PDF to LlamaCloud, parses it to markdown using the SDK's synchronous `parsing.parse` helper, and persists the result and key job metadata so the run can be audited later.

The sample PDF is already present in the environment at `/home/user/parse-task/sample.pdf`.

## Requirements
- Use the official TypeScript SDK `@llamaindex/llama-cloud` (v2.x). Do NOT use the deprecated `llama-cloud-services` package and do NOT call the REST API directly.
- Declare `@llamaindex/llama-cloud` as a dependency in `/home/user/parse-task/package.json`.
- Write your TypeScript source file at `/home/user/parse-task/parse.ts`.
- Authenticate using the `LLAMA_CLOUD_API_KEY` environment variable (already set in the environment).
- Upload `/home/user/parse-task/sample.pdf` to LlamaCloud with the correct purpose for a parse job.
- Run a parse job with:
  - `tier` set to `cost_effective` (this PDF is plain text; do not waste credits on `agentic` or `agentic_plus`).
  - `version` set to `latest`.
  - `expand` requesting markdown output.
- Use the SDK's synchronous helper that blocks until the job finishes — do not poll the REST API yourself.
- Concatenate the markdown of every returned page into a single document, separated by a line containing exactly `---` between pages, and save it to `/home/user/parse-task/output/parsed.md`.
- Append a human-readable log to `/home/user/parse-task/output/result.log` containing the following entries (each on its own line, anywhere in the file):
  - `File ID: <file_id>` (where `<file_id>` is the actual identifier returned by LlamaCloud)
  - `Job ID: <job_id>` (where `<job_id>` is the actual completed parse job identifier returned by LlamaCloud, which must correspond to a real, completed parse job retrievable via `client.parsing.get(<job_id>)`)
  - `Job Status: COMPLETED`
  - `Page Count: <integer>` (the number of pages in the parsed document)
- The script must exit with status 0 on success.

## Implementation Hints
- Initialize the client with `new LlamaCloud()` — the SDK reads `LLAMA_CLOUD_API_KEY` from the environment automatically.
- Upload files with `client.files.create({ file: ..., purpose: ... })`. A Node `ReadStream` from `fs.createReadStream` is a valid value for `file`.
- Call `client.parsing.parse({ file_id, tier, version, expand })` — this awaits until the job is `COMPLETED` and returns the full result, including the job metadata.
- The result object exposes `result.job` (with at least `id` and `status`) and `result.markdown.pages` (an array of objects each containing `page_number` and `markdown`).
- Use `tsx` to run TypeScript files without a separate compilation step (`npx tsx parse.ts`).
- Create the `output/` directory if it does not already exist before writing files.

