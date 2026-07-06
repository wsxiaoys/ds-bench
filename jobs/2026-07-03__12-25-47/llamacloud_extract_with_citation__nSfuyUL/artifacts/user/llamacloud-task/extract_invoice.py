#!/usr/bin/env python3
"""Upload an invoice and run a citation-enabled LlamaCloud Extract v2 job.

Writes the extracted data plus per-field citation metadata to
``/home/user/llamacloud-task/result.json`` and a small text log to
``/home/user/llamacloud-task/output.log``.
"""
from __future__ import annotations

import json
import sys
import time
from pathlib import Path

from llama_cloud import LlamaCloud


PROJECT_DIR = Path("/home/user/llamacloud-task")
INVOICE_PATH = PROJECT_DIR / "sample_invoice.txt"
RUN_ID_PATH = Path("/logs/artifacts/run-id")
OUTPUT_LOG_PATH = PROJECT_DIR / "output.log"
RESULT_PATH = PROJECT_DIR / "result.json"

TERMINAL_STATUSES = {"COMPLETED", "FAILED", "CANCELLED"}

POLL_INTERVAL_SECONDS = 2.0
MAX_POLLS = 300  # ~10 minutes


def _read_run_id() -> str:
    return RUN_ID_PATH.read_text().strip()


def _write_output_log(job_id: str) -> None:
    OUTPUT_LOG_PATH.write_text(
        f"Extract job: {job_id}\n"
        "Status: COMPLETED\n"
    )


def _dump(value):
    """Serialize Pydantic models, dicts, lists, and primitives for JSON output."""
    if hasattr(value, "model_dump"):
        return value.model_dump(mode="json")
    if isinstance(value, dict):
        return {k: _dump(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_dump(v) for v in value]
    return value


def main() -> int:
    run_id = _read_run_id()

    client = LlamaCloud()

    # 1. Upload the invoice.
    external_file_id = f"invoice-{run_id}.txt"
    with INVOICE_PATH.open("rb") as fh:
        uploaded = client.files.create(
            file=fh,
            purpose="extract",
            external_file_id=external_file_id,
        )
    file_id = uploaded.id
    print(f"[extract_invoice] Uploaded file id={file_id} external_file_id={external_file_id}")

    # 2. Define the schema.
    data_schema = {
        "type": "object",
        "properties": {
            "company_name": {"type": "string"},
            "invoice_number": {"type": "string"},
            "total_amount": {"type": "number"},
        },
        "required": ["company_name", "invoice_number", "total_amount"],
    }

    configuration = {
        "extraction_target": "per_doc",
        "tier": "agentic",
        "cite_sources": True,
        "data_schema": data_schema,
    }

    # 3. Create the extraction job.
    job = client.extract.create(
        file_input=file_id,
        configuration=configuration,
    )
    job_id = job.id
    print(f"[extract_invoice] Created extract job id={job_id}")

    # 4. Poll until terminal.
    final_status = None
    for attempt in range(MAX_POLLS):
        current = client.extract.get(job_id)
        final_status = current.status
        print(f"[extract_invoice] poll {attempt}: status={final_status}")
        if final_status in TERMINAL_STATUSES:
            break
        time.sleep(POLL_INTERVAL_SECONDS)
    else:
        print(
            f"[extract_invoice] ERROR: job {job_id} did not reach a terminal status "
            f"within {MAX_POLLS * POLL_INTERVAL_SECONDS:.0f}s (last status={final_status})",
            file=sys.stderr,
        )
        return 1

    if final_status == "FAILED":
        detail = client.extract.get(job_id)
        print(
            f"[extract_invoice] ERROR: extract job {job_id} FAILED: "
            f"{getattr(detail, 'error_message', None)}",
            file=sys.stderr,
        )
        return 1
    if final_status == "CANCELLED":
        print(
            f"[extract_invoice] ERROR: extract job {job_id} was CANCELLED",
            file=sys.stderr,
        )
        return 1

    # 5. Re-fetch with metadata expanded so citations are populated.
    full_job = client.extract.get(job_id, expand=["extract_metadata"])

    extract_result = _dump(full_job.extract_result) or {}
    extract_metadata_obj = _dump(full_job.extract_metadata) or {}
    raw_field_metadata = extract_metadata_obj.get("field_metadata") or {}

    # The API returns per-field entries under field_metadata.document_metadata.
    # Restructure so each leaf field has its own entry directly under field_metadata,
    # as required by the task.
    document_metadata = raw_field_metadata.get("document_metadata") or {}
    restructured_field_metadata = {
        field: document_metadata[field]
        for field in ("company_name", "invoice_number", "total_amount")
        if field in document_metadata
    }

    artifact = {
        "data": {
            "company_name": extract_result.get("company_name"),
            "invoice_number": extract_result.get("invoice_number"),
            "total_amount": extract_result.get("total_amount"),
        },
        "extract_metadata": {
            "field_metadata": restructured_field_metadata,
        },
    }

    RESULT_PATH.write_text(json.dumps(artifact, indent=2) + "\n")
    print(f"[extract_invoice] Wrote {RESULT_PATH}")

    _write_output_log(job_id)
    print(f"[extract_invoice] Wrote {OUTPUT_LOG_PATH}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
