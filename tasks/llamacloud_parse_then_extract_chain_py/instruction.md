# Parse-then-Extract Chain with LlamaCloud (Python)

## Background
LlamaCloud (the LlamaParse platform) provides composable document-AI products. Two of the most common are **Parse** (agentic OCR/layout-aware parsing → markdown) and **Extract** (schema-driven structured-data extraction). A real-world pattern is to **parse a document once** and then **reuse the resulting parse-job ID as the input to one or more Extract jobs** — this avoids re-uploading and re-parsing the same source, saving both time and credits.

You have a sample invoice PDF at `/home/user/myproject/data/invoice.pdf`. Build a Python script that demonstrates this chain end-to-end using the **v2** LlamaCloud SDK (`llama-cloud>=2`).

## Requirements
- Use the Python `llama-cloud` SDK (v2, not the legacy `llama-cloud-services` package).
- Read the `LLAMA_CLOUD_API_KEY` from the environment (already exported in the container).
- Read `run-id` from `/logs/artifacts/run-id` and use it to give the uploaded LlamaCloud file a unique `external_file_id` (specifically, the `external_file_id` must end with the `run-id`).
- Upload `data/invoice.pdf` with `purpose="parse"`.
- Run a Parse job on the uploaded file with `tier="agentic"` and `version="latest"`, requesting markdown output, and save the markdown of the first page to `/home/user/myproject/parsed.md`.
- Reuse the **parse-job ID** (the `pjb-…` identifier) as the `file_input` for an Extract job — do **NOT** upload the file a second time.
- Define a Pydantic schema for invoices with at least these fields: `vendor` (string), `invoice_number` (string), `total_amount` (number), `line_items` (list of strings). Use it as the Extract job's `data_schema`.
- After both jobs complete, persist the structured extraction result as JSON to `/home/user/myproject/extracted.json`.
- Append a single-line summary for each job to `/home/user/myproject/output.log` with the following formats (in any order):
  - `Parse Job ID: pjb-<id>` (where `pjb-<id>` is the actual Parse job ID)
  - `Extract Job ID: <id>` (where `<id>` is the actual Extract job ID)

## Implementation Hints
- The v2 SDK exposes both a sync helper (`client.parsing.parse(...)`) and a lower-level create + wait pattern (`client.parsing.create(...)` then `client.parsing.wait_for_completion(...)` or polling `client.parsing.get(...)`). Either is acceptable, but you need access to the parse-job ID to chain into Extract.
- The Extract API in the v2 SDK uses `file_input=` (which accepts either a file ID `dfl-…` or a parse-job ID `pjb-…`) and a flattened `configuration={...}` dict (not the legacy `config={"extract_options": ...}` wrapper).
- Get a JSON Schema from a Pydantic model with `MyModel.model_json_schema()`.
- `client.extract.create(...)` returns a job; you can either poll with `client.extract.get(job.id)` or use `client.extract.wait_for_completion(job.id)`.
- The structured result is on `job.extract_result` after completion. It is already a JSON-serializable dict / list.
- Make sure both jobs reach the `COMPLETED` state before writing the log line.

