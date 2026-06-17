# Extract Structured Invoice Data with Citations using LlamaCloud Extract v2 (Python)

## Background
You are integrating LlamaCloud's LlamaExtract v2 API into an audit pipeline. For every value the extractor pulls from an invoice, the auditor needs a citation that traces the value back to the source document. The Extract v2 API exposes this via the `cite_sources` configuration option, which causes the response to include `extract_metadata.field_metadata.<field>.citation` entries.

You have a small text invoice already placed in the project directory. Your job is to write a Python script using the `llama-cloud` v2 Python SDK (`from llama_cloud import LlamaCloud`) that uploads this invoice, runs a citation-enabled extraction against a small schema, and writes both the extracted data and the citation metadata to a JSON artifact.

## Requirements
- Use the `llama-cloud` v2 Python SDK (NOT the legacy `llama-cloud-services` v1 wrapper).
- Upload `sample_invoice.txt` from the project directory using `client.files.create(..., purpose="extract")`. Use an `external_file_id` that includes the current run-id read from the `ZEALT_RUN_ID` environment variable so that concurrent runs do not collide in the LlamaCloud dashboard.
- Define a schema (Pydantic model or raw JSON Schema) for the invoice with at least these top-level string/number leaf fields:
  - `company_name` (string)
  - `invoice_number` (string)
  - `total_amount` (number)
- Run a single-document extraction job with `extraction_target: "per_doc"`, `tier: "agentic"`, and `cite_sources: True` in the `configuration` dict passed to `client.extract.create`.
- Poll until the job reaches a terminal status (`COMPLETED`, `FAILED`, or `CANCELLED`). The script must fail loudly if the job ends in `FAILED` or `CANCELLED`.
- On success, write a JSON artifact and a plain-text log file (see Acceptance Criteria for the exact paths and shapes).

## Implementation Hints
- The v2 SDK constructor `LlamaCloud()` reads the API key from the `LLAMA_CLOUD_API_KEY` environment variable; you do not need to hard-code it.
- `client.files.create` accepts a path string or a file-like object opened in binary mode. The bundled `sample_invoice.txt` is a small ASCII document, so a plain file path works.
- The completed job exposes the extracted data and citation metadata on `job.extract_result`. The citation tree is at `extract_result.extract_metadata.field_metadata.<field>.citation` (a list of `{page, matching_text, ...}` objects).
- You can serialize Pydantic v2 SDK response objects with `.model_dump(mode="json")`.
- Do NOT call `client.parsing.parse` or `client.classifier.classify`; only the `files` and `extract` resources are needed.

## Acceptance Criteria
- Project path: `/home/user/llamacloud-task`
- Ensure the script is executed and the artifacts exist (this is a one-off job that creates a real LlamaCloud Extract job).
- Script entrypoint: `python3 /home/user/llamacloud-task/extract_invoice.py` (must run end-to-end and exit 0).
- Log file: `/home/user/llamacloud-task/output.log`
  - Must contain a line in the exact format `Extract job: <job_id>` where `<job_id>` is the LlamaCloud-issued ID for the extract job (typically starts with `ejb-` or `ex-`).
  - Must contain a line in the exact format `Status: COMPLETED`.
- Output JSON artifact: `/home/user/llamacloud-task/result.json`
  - Top-level object with at least the keys `data` and `extract_metadata`.
  - `data` is an object with the leaf keys `company_name`, `invoice_number`, and `total_amount` populated with the values extracted from the document.
  - `extract_metadata` is an object containing a `field_metadata` object. `field_metadata` must contain entries for the leaf fields above, and each entry must contain a non-empty `citation` array whose items have at least the keys `page` and `matching_text`.
- The agent must read the current `run-id` from the `ZEALT_RUN_ID` environment variable and pass `external_file_id="invoice-${run-id}.txt"` (with `${run-id}` substituted) to `client.files.create`.

