#!/usr/bin/env python3
"""End-to-end LlamaExtract v2 SDK: REDACTED-generate a JSON Schema from a prompt
against an invoice PDF, then run structured extraction with that schema.

Outputs:
    /home/user/extract_task/schema.json   - generated JSON Schema
    /home/user/extract_task/result.json   - extracted data
    /home/user/extract_task/output.log    - schema fields, job id, status
"""

import json
import os
import sys
from pathlib import Path

from llama_cloud import LlamaCloud
from llama_cloud.types import ExtractV2Parameters


PROJECT_DIR = Path("/home/user/extract_task")
PDF_PATH = PROJECT_DIR / "data" / "invoice.pdf"
SCHEMA_PATH = PROJECT_DIR / "schema.json"
RESULT_PATH = PROJECT_DIR / "result.json"
LOG_PATH = PROJECT_DIR / "output.log"
RUN_ID_PATH = Path("/logs/artifacts/run-id")

INVOICE_PROMPT = (
    "Extract the key fields from this invoice document. "
    "Include the invoice number, the vendor/seller name, the invoice date, "
    "the due date, line items (with description, quantity, and amount when "
    "available), the subtotal, the tax amount, and the grand total amount. "
    "Return numeric fields as numbers and dates as ISO 8601 strings."
)


def main() -> int:
    # 1) Read run-id
    run_id = RUN_ID_PATH.read_text().strip()
    print(f"Read run-id: {run_id}")

    # 2) Authenticate via env var
    client = LlamaCloud()

    # 3) Upload PDF with external_file_id ending in -<run-id>.pdf
    external_file_id = f"invoice-{run_id}.pdf"
    with open(PDF_PATH, "rb") as fh:
        uploaded = client.files.create(
            file=(PDF_PATH.name, fh, "application/pdf"),
            purpose="extract",
            external_file_id=external_file_id,
        )
    file_id = uploaded.id
    print(f"Uploaded file: id={file_id}, external_file_id={external_file_id}")

    # 4) Auto-generate a JSON Schema from the prompt and the sample PDF
    generated = client.extract.generate_schema(
        name="invoice-extraction",
        prompt=INVOICE_PROMPT,
        file_id=file_id,
    )
    schema = generated.parameters.data_schema
    print("Generated schema:")
    print(json.dumps(schema, indent=2))

    # Validate the generated schema against the task requirements
    if schema.get("type") != "object":
        raise ValueError("Generated schema must have type=object")
    properties = schema.get("properties") or {}
    if not isinstance(properties, dict) or len(properties) < 3:
        raise ValueError("Generated schema must have at least 3 properties")

    # Save the generated schema
    with open(SCHEMA_PATH, "w") as fh:
        json.dump(schema, fh, indent=2)
    print(f"Wrote schema to {SCHEMA_PATH}")

    # 5) Run extraction using the generated schema
    config = ExtractV2Parameters(
        data_schema=schema,
        product_type="extract_v2",
        extraction_target="per_doc",
        tier="agentic",
    )

    job = client.extract.create(
        file_input=file_id,
        configuration=config,
    )
    print(f"Created extraction job: id={job.id}")

    # 6) Poll until terminal state
    final = client.extract.wait_for_completion(
        job.id,
        polling_interval=1.0,
        max_interval=5.0,
    )

    print(f"Job {final.id} reached status={final.status}")
    if final.status != "COMPLETED":
        print("ERROR:", final.error_message, file=sys.stderr)
        return 1

    extract_result = final.extract_result
    if not extract_result:
        raise RuntimeError("Job completed but no extract_result was returned")

    # 7) Persist extracted record
    with open(RESULT_PATH, "w") as fh:
        json.dump(extract_result, fh, indent=2)
    print(f"Wrote extraction result to {RESULT_PATH}")

    # 8) Write the log file (three lines: schema fields, job id, status)
    field_names = list(properties.keys())
    schema_log = f"Schema fields: {', '.join(field_names)}"
    job_log = f"Job ID: {final.id}"
    status_log = f"Status: {final.status}"

    log_lines = [schema_log, job_log, status_log]
    with open(LOG_PATH, "w") as fh:
        fh.write("\n".join(log_lines) + "\n")
    print(f"Wrote log to {LOG_PATH}")
    print()
    print("---- output.log ----")
    for line in log_lines:
        print(line)

    return 0


if __name__ == "__main__":
    sys.exit(main())
