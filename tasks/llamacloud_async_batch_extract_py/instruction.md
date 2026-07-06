# Async Batch Extraction with LlamaCloud (Python)

## Background
LlamaCloud (the LlamaParse platform) exposes a structured-data **Extract** product that can process many documents in parallel. For high-throughput production pipelines, the recommended Python pattern is to use the `AsyncLlamaCloud` client together with an `asyncio.Semaphore` to bound concurrency and avoid throttling.

You are given a small folder of three invoice PDFs at `/home/user/myproject/data/` (filenames: `invoice_a.pdf`, `invoice_b.pdf`, `invoice_c.pdf`). Each invoice was generated with a known vendor name baked into it. Build a Python script that performs **concurrent extraction across all of them** using the v2 LlamaCloud SDK (`llama-cloud>=2`).

## Requirements
- Use the Python `llama-cloud` SDK v2 (NOT the legacy `llama-cloud-services` package).
- Use `AsyncLlamaCloud` and `asyncio` (not the sync client).
- Bound concurrency to at most 3 simultaneous in-flight extract jobs using an `asyncio.Semaphore`.
- Read the API key from the `LLAMA_CLOUD_API_KEY` environment variable (already exported).
- Read `run-id` from `/logs/artifacts/run-id` and append it as a suffix to each uploaded file's `external_file_id` (e.g. `invoice_a-<run-id>`).
- Upload all three PDFs from `/home/user/myproject/data/` with `purpose="extract"`.
- Define a Pydantic schema for invoices with at least: `vendor_name` (string), `invoice_number` (string), `total_amount` (number), and `line_items` (list of strings).
- For each uploaded file, create an extract job with `extraction_target="per_doc"` and `tier="cost_effective"` using the above schema (passed via `data_schema` in the `configuration` dict).
- Wait for all jobs to complete successfully (status `COMPLETED`).
- Persist the consolidated per-file results to `/home/user/myproject/results.json` as a JSON object mapping `original_filename` (e.g. `invoice_a.pdf`) → extracted record containing the schema keys.
- Append a single line to `/home/user/myproject/output.log` for each finished extract job in the format `Extract Job: <filename> <job_id> <status>`. The status value for all successfully completed jobs must be `COMPLETED`.

## Implementation Hints
- The v2 async client is imported as `from llama_cloud import AsyncLlamaCloud`. All methods are coroutines (`await async_client.files.create(...)`, `await async_client.extract.create(...)`, `await async_client.extract.get(...)`).
- Use `MyModel.model_json_schema()` to obtain a JSON Schema from a Pydantic model for the `data_schema` configuration.
- `client.files.create(...)` accepts `external_file_id=` as a kwarg to label the upload.
- The Extract API in v2 uses `file_input=` (which accepts either a file ID `dfl-…` or a parse-job ID `pjb-…`) and a flattened `configuration={...}` dict (NOT the legacy `config={"extract_options": ...}` wrapper).
- After polling (`await async_client.extract.get(job.id)`), inspect `job.status`; on success, the structured result is in `job.extract_result`.
- Use `asyncio.gather(...)` to fan out per-file processing tasks. Each task should acquire the shared `asyncio.Semaphore(3)` before contacting LlamaCloud.
- Poll job status with a non-trivial `await asyncio.sleep(...)` interval (a couple of seconds is fine) — busy-waiting will trip rate limits.

