"""End-to-end LlamaExtract v2: REDACTED-generate a schema, run extraction, save outputs."""
import json
import os
import time
from pathlib import Path

from llama_cloud import LlamaCloud

ROOT = Path("/home/user/extract_task")
PDF_PATH = ROOT / "data" / "invoice.pdf"
SCHEMA_PATH = ROOT / "schema.json"
RESULT_PATH = ROOT / "result.json"
LOG_PATH = ROOT / "output.log"
RUN_ID_FILE = Path("/logs/artifacts/run-id")

PROMPT = (
    "Extract the key fields from this invoice, including the invoice number/ID, "
    "the vendor/seller/supplier, and the total amount along with any summary or "
    "subtotal values."
)


def read_run_id() -> str:
    return RUN_ID_FILE.read_text().strip()


def main() -> None:
    run_id = read_run_id()
    external_file_id = f"invoice-{run_id}.pdf"
    print(f"[info] run-id={run_id!r} external_file_id={external_file_id!r}")

    client = LlamaCloud(api_key=os.environ["LLAMA_CLOUD_API_KEY"])

    # 1) Upload the invoice PDF for extraction use.
    with PDF_PATH.open("rb") as fh:
        uploaded = client.files.create(
            file=fh,
            purpose="extract",
            external_file_id=external_file_id,
        )
    file_id = uploaded.id
    print(f"[info] uploaded file_id={file_id}")

    # 2) Auto-generate a JSON Schema from a natural-language prompt and the sample file.
    generated = client.extract.generate_schema(
        prompt=PROMPT,
        file_id=file_id,
    )
    data_schema = generated.parameters.data_schema
    # Persist the schema to disk as required.
    SCHEMA_PATH.write_text(json.dumps(data_schema, indent=2))
    print(f"[info] generated schema written to {SCHEMA_PATH}")

    properties = data_schema.get("properties", {})
    field_names = list(properties.keys())
    print(f"[info] schema field names: {field_names}")

    # 3) Run structured extraction with the generated schema.
    job = client.extract.create(
        file_input=file_id,
        configuration={
            "data_schema": data_schema,
            "extraction_target": "per_doc",
            "tier": "agentic",
        },
    )
    job_id = job.id
    print(f"[info] created extract job_id={job_id}")

    # 4) Poll until the job reaches a terminal state.
    terminal = {"COMPLETED", "FAILED", "CANCELLED"}
    status = job.status
    while status not in terminal:
        time.sleep(3)
        job = client.extract.get(job_id=job_id)
        status = job.status
        print(f"[info] poll: job_id={job_id} status={status}")

    if status != "COMPLETED":
        raise RuntimeError(
            f"Extract job {job_id} ended with status={status}: {job.error_message}"
        )

    extract_result = job.extract_result
    print(f"[info] extract_result keys: {list((extract_result or {}).keys())}")

    # 5) Persist the extracted JSON.
    RESULT_PATH.write_text(json.dumps(extract_result, indent=2, default=str))
    print(f"[info] extracted result written to {RESULT_PATH}")

    # 6) Write the log file with exactly three lines (any order).
    schema_fields_line = f"Schema fields: {','.join(field_names)}"
    job_id_line = f"Job ID: {job_id}"
    status_line = f"Status: {status}"
    LOG_PATH.write_text(
        f"{schema_fields_line}\n{job_id_line}\n{status_line}\n"
    )
    print(f"[info] log written to {LOG_PATH}")


if __name__ == "__main__":
    main()