# Auto-Generate a LlamaExtract Schema and Run Extraction (Python)

## Background
LlamaCloud's **LlamaExtract** v2 SDK can synthesize a JSON Schema directly from a natural-language prompt via `client.extract.generate_schema(...)`. This is useful when you don't yet know the exact shape of the data you want to pull from a document. Once you have a generated schema, you can feed it straight into `client.extract.create(...)` to perform structured extraction. In this task you will combine both steps end-to-end against a real invoice PDF using the Python SDK (`llama-cloud>=2`).

## Requirements
- All code and operations should be run in the project directory `/home/user/extract_task`. Do not mock any SDK calls; execute them against the real LlamaCloud API.
- Use `/home/user/extract_task/data/invoice.pdf` as the input PDF.
- Auto-generate a JSON Schema object for invoice data using `client.extract.generate_schema` and save it to `/home/user/extract_task/schema.json`.
  - The schema must be a valid JSON Schema object with `"type": "object"` and a `"properties"` map containing at least 3 distinct properties.
  - These properties must collectively cover standard invoice concepts: an invoice number or ID, a vendor or supplier/seller/merchant, and a total amount or summary/subtotal.
- Use that generated schema to run a structured extraction on the input PDF and save the extracted JSON to `/home/user/extract_task/result.json` (as a valid JSON object with at least one populated field).
- Upload the PDF file with an `external_file_id` that ends with `-<run-id>.pdf`, where `<run-id>` is read from `/logs/artifacts/run-id`.
- Write a log file to `/home/user/extract_task/output.log` containing exactly three lines (in any order) with the following formats:
  - `Schema fields: <comma-separated property names>` listing the top-level properties of the generated schema.
  - `Job ID: <job_id>` where `<job_id>` is the LlamaCloud extract job ID.
  - `Status: COMPLETED`

## Implementation Hints
- The Python SDK (`llama-cloud>=2`) is already installed system-wide; import `LlamaCloud` from `llama_cloud` and authenticate via the `LLAMA_CLOUD_API_KEY` environment variable.
- Read `run-id` from `/logs/artifacts/run-id` and use it in `external_file_id` (e.g. `invoice-<run-id>.pdf`) when calling `client.files.create(file=..., purpose="extract", external_file_id=...)`.
- Pass both `prompt=` and `file_id=` to `client.extract.generate_schema(...)` so the generator can look at the sample document, then use `generated.parameters.data_schema` as the `data_schema` in the extraction configuration.
- Use a single-document configuration (`extraction_target="per_doc"`, `tier="agentic"`) and poll until the job reaches a terminal state (`COMPLETED`, `FAILED`, or `CANCELLED`).
- The extracted record is available on the completed job's `extract_result` attribute.

