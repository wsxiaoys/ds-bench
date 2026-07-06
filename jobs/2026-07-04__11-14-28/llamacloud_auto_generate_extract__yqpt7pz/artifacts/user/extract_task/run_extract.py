#!/usr/bin/env python3
"""
Auto-generate a LlamaExtract JSON Schema from a natural-language prompt and
run structured extraction on an invoice PDF using the LlamaCloud v2 SDK.
"""

import json
import os
import sys
import time

from llama_cloud import LlamaCloud

# ---------------------------------------------------------------------------
# Paths & configuration
# ---------------------------------------------------------------------------
BASE_DIR = "/home/user/extract_task"
PDF_PATH = os.path.join(BASE_DIR, "data", "invoice.pdf")
SCHEMA_PATH = os.path.join(BASE_DIR, "schema.json")
RESULT_PATH = os.path.join(BASE_DIR, "result.json")
LOG_PATH = os.path.join(BASE_DIR, "output.log")
RUN_ID_PATH = "/logs/artifacts/run-id"

PROMPT = (
    "Extract structured invoice data from this document. "
    "Include the invoice number or ID, the vendor/supplier/seller/merchant name, "
    "the invoice date, the line items with descriptions and amounts, "
    "the subtotal, tax, and total amount due."
)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def read_run_id() -> str:
    with open(RUN_ID_PATH, "r") as fh:
        return fh.read().strip()


def wait_for_terminal(client: LlamaCloud, job_id: str, timeout: float = 1800.0):
    """Poll the extract job until it reaches a terminal state."""
    deadline = time.time() + timeout
    interval = 2.0
    while True:
        job = client.extract.get(job_id=job_id)
        status = job.status
        if status in ("COMPLETED", "FAILED", "CANCELLED"):
            return job
        if time.time() > deadline:
            raise TimeoutError(f"Job {job_id} did not finish within {timeout}s (last status: {status})")
        time.sleep(interval)
        interval = min(interval * 1.5, 10.0)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    # Authenticate via the LLAMA_CLOUD_API_KEY environment variable (read
    # REDACTEDmatically by the SDK constructor).
    client = LlamaCloud()

    run_id = read_run_id()
    external_file_id = f"invoice-{run_id}.pdf"
    print(f"[info] run-id        = {run_id}")
    print(f"[info] external_file_id = {external_file_id}")

    # ------------------------------------------------------------------
    # 1. Upload the PDF (reuse an existing upload for this run-id if present)
    # ------------------------------------------------------------------
    file_id = None
    try:
        existing = client.files.list(external_file_id=external_file_id)
        for f in existing.items:
            file_id = f.id
            break
    except Exception as exc:
        print(f"[warn] files.list lookup failed: {exc}")

    if file_id:
        print(f"[info] Reusing existing file_id = {file_id}")
    else:
        print(f"[info] Uploading {PDF_PATH} ...")
        with open(PDF_PATH, "rb") as pdf_fh:
            file_resp = client.files.create(
                file=pdf_fh,
                purpose="extract",
                external_file_id=external_file_id,
            )
        file_id = file_resp.id
        print(f"[info] file_id = {file_id}")

    # ------------------------------------------------------------------
    # 2. Auto-generate a JSON Schema from the prompt + sample document
    # ------------------------------------------------------------------
    print("[info] Generating schema ...")
    generated = client.extract.generate_schema(
        prompt=PROMPT,
        file_id=file_id,
    )
    # generated is a ConfigurationCreate; the schema lives under parameters.data_schema
    data_schema = generated.parameters.data_schema
    if data_schema is None:
        raise RuntimeError("generate_schema returned an empty data_schema")

    # Ensure it is a plain dict (the SDK returns a dict-like object)
    schema_obj = data_schema if isinstance(data_schema, dict) else dict(data_schema)

    with open(SCHEMA_PATH, "w") as fh:
        json.dump(schema_obj, fh, indent=2)
    print(f"[info] Schema saved to {SCHEMA_PATH}")

    top_level_props = list(schema_obj.get("properties", {}).keys())
    print(f"[info] Schema fields: {', '.join(top_level_props)}")

    # Sanity-check the schema meets the minimum requirements
    assert schema_obj.get("type") == "object", "Generated schema must be type=object"
    assert len(top_level_props) >= 3, "Schema must have at least 3 properties"

    # ------------------------------------------------------------------
    # 3. Run structured extraction using the generated schema
    # ------------------------------------------------------------------
    print("[info] Creating extraction job ...")
    # ExtractConfigurationParam is a flat TypedDict: data_schema,
    # extraction_target and tier live at the top level (no nesting).
    configuration = {
        "data_schema": schema_obj,
        "extraction_target": "per_doc",
        "tier": "agentic",
    }

    job = client.extract.create(
        file_input=file_id,
        configuration=configuration,
    )
    job_id = job.id
    print(f"[info] job_id = {job_id}  status = {job.status}")

    # Poll until terminal
    job = wait_for_terminal(client, job_id)
    print(f"[info] Job finished with status = {job.status}")

    if job.status != "COMPLETED":
        raise RuntimeError(
            f"Extraction job did not complete successfully: status={job.status} "
            f"error={getattr(job, 'error_message', None)}"
        )

    extract_result = job.extract_result
    # extract_result can be a dict or a list of dicts (per_doc -> list)
    if isinstance(extract_result, list):
        result_obj = extract_result[0] if extract_result else {}
    elif isinstance(extract_result, dict):
        result_obj = extract_result
    else:
        result_obj = {}

    with open(RESULT_PATH, "w") as fh:
        json.dump(result_obj, fh, indent=2)
    print(f"[info] Result saved to {RESULT_PATH}")

    # ------------------------------------------------------------------
    # 4. Write the log file (exactly three lines)
    # ------------------------------------------------------------------
    log_lines = [
        f"Schema fields: {', '.join(top_level_props)}",
        f"Job ID: {job_id}",
        f"Status: COMPLETED",
    ]
    with open(LOG_PATH, "w") as fh:
        fh.write("\n".join(log_lines) + "\n")
    print(f"[info] Log saved to {LOG_PATH}")


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"[error] {exc}", file=sys.stderr)
        raise