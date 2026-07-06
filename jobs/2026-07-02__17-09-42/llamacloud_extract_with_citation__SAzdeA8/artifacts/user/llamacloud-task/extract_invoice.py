"""Extract structured invoice data with citations using LlamaCloud Extract v2.

Uploads ``sample_invoice.txt`` to LlamaCloud, runs a citation-enabled single
document extraction against a small schema, polls until the job reaches a
terminal status, and writes:

* a plain-text log at ``output.log`` with the job id and final status, and
* a JSON artifact at ``result.json`` with the extracted data and the
  per-field citation metadata.

Only the ``files`` and ``extract`` resources of the ``llama-cloud`` v2 SDK are
used; no calls to ``client.parsing.parse`` or ``client.classifier.classify``
are made.
"""

from __future__ import annotations

import json
import sys
import time
from pathlib import Path
from typing import Any, Dict

from llama_cloud import LlamaCloud


# ---------------------------------------------------------------------------
# Constants and locations
# ---------------------------------------------------------------------------

PROJECT_DIR = Path("/home/user/llamacloud-task")
INVOICE_PATH = PROJECT_DIR / "sample_invoice.txt"
RUN_ID_PATH = Path("/logs/artifacts/run-id")
OUTPUT_LOG_PATH = PROJECT_DIR / "output.log"
RESULT_JSON_PATH = PROJECT_DIR / "result.json"

# JSON Schema describing the invoice fields the auditor cares about. Using a
# raw JSON Schema keeps the payload portable and avoids coupling the script
# to any specific Pydantic version.
INVOICE_SCHEMA: Dict[str, Any] = {
    "type": "object",
    "properties": {
        "company_name": {"type": "string", "description": "The vendor/company that issued the invoice."},
        "invoice_number": {"type": "string", "description": "The invoice number/identifier."},
        "total_amount": {"type": "number", "description": "The total amount due on the invoice."},
    },
    "required": ["company_name", "invoice_number", "total_amount"],
}

LEAF_FIELDS = ("company_name", "invoice_number", "total_amount")

TERMINAL_STATUSES = {"COMPLETED", "FAILED", "CANCELLED"}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def read_run_id(path: Path = RUN_ID_PATH) -> str:
    """Return the run id from the artifacts directory, stripped of whitespace."""
    return path.read_text().strip()


def serialize(value: Any) -> Any:
    """Recursively convert Pydantic models (or nested containers) to plain JSON."""
    if hasattr(value, "model_dump"):
        return value.model_dump(mode="json")
    if isinstance(value, dict):
        return {k: serialize(v) for k, v in value.items()}
    if isinstance(value, list):
        return [serialize(item) for item in value]
    if isinstance(value, tuple):
        return [serialize(item) for item in value]
    return value


# ---------------------------------------------------------------------------
# Main pipeline
# ---------------------------------------------------------------------------


def find_existing_file_id(client: LlamaCloud, external_file_id: str) -> str | None:
    """Return the LlamaCloud file id for a previously uploaded external id, if any."""
    for f in client.files.list(external_file_id=external_file_id):
        return f.id
    return None


def main() -> int:
    run_id = read_run_id()
    external_file_id = f"invoice-{run_id}.txt"
    print(f"[extract_invoice] Using run-id={run_id} external_file_id={external_file_id}")

    client = LlamaCloud()

    # 1. Upload the invoice as a file intended for extraction. If a previous run
    #    with the same run-id already uploaded the file, look it up by its
    #    external id and reuse it so the script is idempotent across re-runs.
    try:
        file_resp = client.files.create(
            file=str(INVOICE_PATH),
            purpose="extract",
            external_file_id=external_file_id,
        )
        file_id = file_resp.id
        print(f"[extract_invoice] Uploaded file id={file_id}")
    except Exception as exc:  # noqa: BLE001
        existing_id = find_existing_file_id(client, external_file_id)
        if existing_id is None:
            raise
        print(
            f"[extract_invoice] Reusing existing file id={existing_id} for "
            f"external_file_id={external_file_id} (create error: {exc!r})"
        )
        file_id = existing_id

    # 2. Build the extract configuration with citations enabled.
    configuration: Dict[str, Any] = {
        "data_schema": INVOICE_SCHEMA,
        "extraction_target": "per_doc",
        "tier": "agentic",
        "cite_sources": True,
    }

    # 3. Create the extraction job.
    job = client.extract.create(
        file_input=file_id,
        configuration=configuration,
    )
    job_id = job.id
    print(f"[extract_invoice] Created extract job: {job_id}")

    # 4. Poll until the job reaches a terminal status. We expand
    #    ``extract_metadata`` so the completed job carries the per-field
    #    citation tree needed downstream.
    status = job.status
    while status not in TERMINAL_STATUSES:
        time.sleep(2.0)
        job = client.extract.get(job_id, expand=["extract_metadata"])
        status = job.status
        print(f"[extract_invoice] Job {job_id} status={status}")

    if status in {"FAILED", "CANCELLED"}:
        # Fail loudly so a downstream audit pipeline notices.
        raise RuntimeError(
            f"Extract job {job_id} ended in terminal status {status}: "
            f"{getattr(job, 'error_message', None)}"
        )

    # 5. Build the citation metadata block. The SDK nests the citations at
    #    job.extract_result.extract_metadata.field_metadata.<field>.citation
    #    when ``cite_sources`` is enabled.
    extract_result = serialize(getattr(job, "extract_result", None)) or {}
    extract_metadata_raw = getattr(job, "extract_metadata", None)
    extract_metadata = serialize(extract_metadata_raw) or {}

    field_metadata: Dict[str, Any] = {}
    fm_root = extract_metadata.get("field_metadata") if isinstance(extract_metadata, dict) else None
    if isinstance(fm_root, dict):
        document_metadata = fm_root.get("document_metadata")
        if isinstance(document_metadata, dict):
            for field in LEAF_FIELDS:
                entry = document_metadata.get(field)
                if isinstance(entry, dict):
                    field_metadata[field] = entry

    result_payload: Dict[str, Any] = {
        "data": {
            "company_name": extract_result.get("company_name"),
            "invoice_number": extract_result.get("invoice_number"),
            "total_amount": extract_result.get("total_amount"),
        },
        "extract_metadata": {
            "field_metadata": field_metadata,
        },
    }

    # 6. Write the JSON artifact.
    RESULT_JSON_PATH.write_text(json.dumps(result_payload, indent=2, sort_keys=True))
    print(f"[extract_invoice] Wrote {RESULT_JSON_PATH}")

    # 7. Write the plain-text log with the two required lines.
    log_lines = [
        f"Extract job: {job_id}",
        "Status: COMPLETED",
    ]
    OUTPUT_LOG_PATH.write_text("\n".join(log_lines) + "\n")
    print(f"[extract_invoice] Wrote {OUTPUT_LOG_PATH}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
