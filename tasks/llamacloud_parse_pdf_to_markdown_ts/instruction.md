# Parse a PDF to Markdown with the LlamaCloud TypeScript SDK

## Background
LlamaCloud's Parse product is an agentic OCR / layout-aware document parser that turns PDFs (and 130+ other file types) into clean markdown, text, JSON, and more. It is part of the LlamaCloud (LlamaParse) platform and is consumed through the `@llamaindex/llama-cloud` Node.js SDK (v2+).

Your job is to write a small TypeScript program that uploads a sample PDF to LlamaCloud, parses it to markdown using the SDK's synchronous `parsing.parse` helper, and persists the result and key job metadata so the run can be audited later.

The sample PDF is already present in the environment at `/home/user/parse-task/sample.pdf`.

## Requirements
- Use the official TypeScript SDK `@llamaindex/llama-cloud` (v2.x). Do NOT use the deprecated `llama-cloud-services` package and do NOT call the REST API directly.
- Authenticate using the `LLAMA_CLOUD_API_KEY` environment variable (already set in the environment).
- Upload `/home/user/parse-task/sample.pdf` to LlamaCloud with the correct purpose for a parse job.
- Run a parse job with:
  - `tier` set to `cost_effective` (this PDF is plain text; do not waste credits on `agentic` or `agentic_plus`).
  - `version` set to `latest`.
  - `expand` requesting markdown output.
- Use the SDK's synchronous helper that blocks until the job finishes — do not poll the REST API yourself.
- Concatenate the markdown of every returned page into a single document, separated by a line containing exactly `---` between pages, and save it to `/home/user/parse-task/output/parsed.md`.
- Append a human-readable log to `/home/user/parse-task/output/result.log` containing one entry per line in the exact formats listed in the acceptance criteria below.
- The script must exit with status 0 on success.

## Implementation Hints
- Initialize the client with `new LlamaCloud()` — the SDK reads `LLAMA_CLOUD_API_KEY` from the environment automatically.
- Upload files with `client.files.create({ file: ..., purpose: ... })`. A Node `ReadStream` from `fs.createReadStream` is a valid value for `file`.
- Call `client.parsing.parse({ file_id, tier, version, expand })` — this awaits until the job is `COMPLETED` and returns the full result, including the job metadata.
- The result object exposes `result.job` (with at least `id` and `status`) and `result.markdown.pages` (an array of objects each containing `page_number` and `markdown`).
- Use `tsx` to run TypeScript files without a separate compilation step (`npx tsx parse.ts`).
- Create the `output/` directory if it does not already exist before writing files.

## Acceptance Criteria
- Project path: `/home/user/parse-task`
- Ensure the real parse action is executed against the LlamaCloud API and the output artifacts exist.
- The TypeScript source file must live at `/home/user/parse-task/parse.ts` (the verifier may re-run it).
- Parsed markdown file: `/home/user/parse-task/output/parsed.md` — must be non-empty and contain at least some textual content from the source PDF.
- Log file: `/home/user/parse-task/output/result.log` — must contain (each on its own line, anywhere in the file):
  - `File ID: <file_id>`
  - `Job ID: <job_id>`
  - `Job Status: COMPLETED`
  - `Page Count: <integer>`
- The `<file_id>` and `<job_id>` values must be the actual identifiers returned by LlamaCloud (UUID-like strings) and the `<job_id>` must correspond to a real, completed parse job retrievable via `client.parsing.get(<job_id>)`.
- The `tier` used for the parse job, as recorded on the job in LlamaCloud, must be `cost_effective`.
- A `package.json` at `/home/user/parse-task/package.json` must list `@llamaindex/llama-cloud` as a dependency.

