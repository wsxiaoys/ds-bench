# Auto-Generate a LlamaExtract Schema and Run Extraction (Python)

## Background
LlamaCloud's **LlamaExtract** v2 SDK can synthesize a JSON Schema directly from a natural-language prompt via `client.extract.generate_schema(...)`. This is useful when you don't yet know the exact shape of the data you want to pull from a document. Once you have a generated schema, you can feed it straight into `client.extract.create(...)` to perform structured extraction. In this task you will combine both steps end-to-end against a real invoice PDF using the Python SDK (`llama-cloud>=2`).

## Requirements
- Auto-generate a JSON Schema for invoice data using `client.extract.generate_schema` and save it to disk.
- Use that generated schema to run a structured extraction on the provided invoice PDF and save the extracted JSON to disk.
- Write a log file recording the generated schema's top-level field names and the extraction job ID.
- Append the current `run-id` (from `ZEALT_RUN_ID`) to the uploaded file's `external_file_id` so concurrent runs don't collide.

## Implementation Hints
- The Python SDK (`llama-cloud>=2`) is already installed system-wide; import `LlamaCloud` from `llama_cloud` and authenticate via the `LLAMA_CLOUD_API_KEY` environment variable.
- Read `run-id` from `ZEALT_RUN_ID` and use it in `external_file_id` (e.g. `invoice-<run-id>.pdf`) when calling `client.files.create(file=..., purpose="extract", external_file_id=...)`.
- Pass both `prompt=` and `file_id=` to `client.extract.generate_schema(...)` so the generator can look at the sample document, then use `generated.parameters.data_schema` as the `data_schema` in the extraction configuration.
- Use a single-document configuration (`extraction_target="per_doc"`, `tier="agentic"`) and poll until the job reaches a terminal state (`COMPLETED`, `FAILED`, or `CANCELLED`).
- The extracted record is available on the completed job's `extract_result` attribute.

## Acceptance Criteria
- Project path: /home/user/extract_task
- Ensure the script is actually executed against the real LlamaCloud API; do not mock any SDK calls.
- Input PDF: /home/user/extract_task/data/invoice.pdf (provided)
- Generated schema file: /home/user/extract_task/schema.json
  - Valid JSON.
  - Must be a JSON Schema object (contains `"type": "object"` and a `"properties"` map).
  - Must include at least 3 distinct properties whose key names collectively reference invoice-style concepts (invoice number/id, vendor/supplier/seller, and total/amount/summary/subtotal).
- Extraction result file: /home/user/extract_task/result.json
  - Valid JSON object with at least one populated field.
- Log file: /home/user/extract_task/output.log
  - Contains a line exactly matching `Schema fields: <comma-separated property names>` listing the top-level properties of the generated schema.
  - Contains a line exactly matching `Job ID: <job_id>` where `<job_id>` is the LlamaCloud extract job id (begins with `ej-`, `exj-`, or `ext-`).
  - Contains a line exactly matching `Status: COMPLETED`.
- The uploaded file's `external_file_id` must end with `-${ZEALT_RUN_ID}.pdf`.

