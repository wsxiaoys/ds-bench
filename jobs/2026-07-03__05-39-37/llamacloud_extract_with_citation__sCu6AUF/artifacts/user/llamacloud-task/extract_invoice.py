#!/usr/bin/env python3
"""Extract structured invoice data with citations using LlamaCloud Extract v2.

Uploads a small text invoice, runs a citation-enabled extraction against a
small schema, and writes both the extracted data and the citation metadata to
a JSON artifact.
"""

from __future__ import annotations

import json
import os
import sys
import time
from pathlib import Path
from typing import Any, Dict, List, Optional

from llama_cloud import LlamaCloud

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
PROJECT_DIR = Path("/home/user/llamacloud-task")
INVOICE_PATH = PROJECT_DIR / "sample_invoice.txt"
RUN_ID_PATH = Path("/logs/artifacts/run-id")
OUTPUT_LOG_PATH = PROJECT_DIR / "output.log"
RESULT_JSON_PATH = PROJECT_DIR / "result.json"

# Leaf fields we care about for the artifact.
LEAF_FIELDS = ["company_name", "invoice_number", "total_amount"]

# Polling configuration.
POLL_INTERVAL_SECONDS = 5
POLL_TIMEOUT_SECONDS = 600  # 10 minutes is plenty for a tiny ASCII invoice.

TERMINAL_STATUSES = {"COMPLETED", "FAILED", "CANCELLED"}

# JSON Schema describing the invoice fields to extract.
INVOICE_SCHEMA: Dict[str, Any] = {
    "type": "object",
    "properties": {
        "company_name": {
            "type": "string",
            "description": "The name of the vendor / company issuing the invoice.",
        },
        "invoice_number": {
            "type": "string",
            "description": "The invoice number / identifier on the invoice.",
        },
        "total_amount": {
            "type": "number",
            "description": "The total amount due on the invoice.",
        },
    },
    "required": ["company_name", "invoice_number", "total_amount"],
}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def read_run_id() -> str:
    """Read the current run-id from the artifacts directory."""
    raw = RUN_ID_PATH.read_text(encoding="utf-8").strip()
    if not raw:
        raise RuntimeError(f"Run ID file at {RUN_ID_PATH} is empty.")
    return raw


def extract_citations(field_meta: Any) -> List[Dict[str, Any]]:
    """Normalize a field-metadata entry into a list of citation dicts.

    Each returned citation is guaranteed to have at least ``page`` and
    ``matching_text`` keys (when present in the source).
    """
    citations: List[Dict[str, Any]] = []
    if not isinstance(field_meta, dict):
        return citations

    raw_citations = field_meta.get("citation")
    if not isinstance(raw_citations, list):
        return citations

    for cite in raw_citations:
        if not isinstance(cite, dict):
            # Pydantic v2 SDK objects serialized via model_dump are already dicts,
            # but be defensive in case a BaseModel slips through.
            try:
                cite = cite.model_dump(mode="json")  # type: ignore[attr-defined]
            except AttributeError:
                continue
        if not isinstance(cite, dict):
            continue
        normalized: Dict[str, Any] = {}
        if "page" in cite:
            normalized["page"] = cite["page"]
        if "matching_text" in cite:
            normalized["matching_text"] = cite["matching_text"]
        # Preserve any other keys for transparency.
        for k, v in cite.items():
            if k not in normalized:
                normalized[k] = v
        citations.append(normalized)
    return citations


def build_field_metadata(raw_field_metadata: Any) -> Dict[str, Dict[str, Any]]:
    """Build the ``field_metadata`` object for the artifact.

    The LlamaCloud v2 API returns per-field metadata keyed under
    ``document_metadata`` (for ``per_doc`` extraction). Some responses may place
    the field entries directly on ``field_metadata``. We handle both shapes and
    return a mapping ``{field: {"citation": [...]}}`` for each requested leaf
    field.
    """
    source: Dict[str, Any] = {}
    if isinstance(raw_field_metadata, dict):
        if isinstance(raw_field_metadata.get("document_metadata"), dict):
            source = raw_field_metadata["document_metadata"]
        else:
            # Field entries may be placed directly on field_metadata.
            source = raw_field_metadata

    result: Dict[str, Dict[str, Any]] = {}
    for field in LEAF_FIELDS:
        entry = source.get(field)
        citations = extract_citations(entry) if entry is not None else []
        result[field] = {"citation": citations}
    return result


def write_log(job_id: str) -> None:
    OUTPUT_LOG_PATH.write_text(
        f"Extract job: {job_id}\nStatus: COMPLETED\n",
        encoding="utf-8",
    )


def write_result(data: Dict[str, Any], field_metadata: Dict[str, Dict[str, Any]]) -> None:
    artifact = {
        "data": data,
        "extract_metadata": {"field_metadata": field_metadata},
    }
    RESULT_JSON_PATH.write_text(
        json.dumps(artifact, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )


# ---------------------------------------------------------------------------
# Main flow
# ---------------------------------------------------------------------------
def main() -> int:
    if "LLAMA_CLOUD_API_KEY" not in os.environ:
        print("ERROR: LLAMA_CLOUD_API_KEY environment variable is not set.", file=sys.stderr)
        return 2

    if not INVOICE_PATH.exists():
        print(f"ERROR: invoice file not found at {INVOICE_PATH}", file=sys.stderr)
        return 2

    run_id = read_run_id()
    external_file_id = f"invoice-{run_id}.txt"
    print(f"Run ID: {run_id}")
    print(f"External file id: {external_file_id}")

    client = LlamaCloud()

    # 1. Upload the invoice file.
    print(f"Uploading {INVOICE_PATH} ...")
    file_resp = client.files.create(
        file=str(INVOICE_PATH),
        purpose="extract",
        external_file_id=external_file_id,
    )
    file_id = file_resp.id
    print(f"Uploaded file id: {file_id}")

    # 2. Create the extract job with citations enabled.
    configuration = {
        "data_schema": INVOICE_SCHEMA,
        "extraction_target": "per_doc",
        "tier": "agentic",
        "cite_sources": True,
    }
    print("Creating extract job ...")
    job = client.extract.create(
        file_input=file_id,
        configuration=configuration,  # type: ignore[arg-type]
    )
    job_id = job.id
    print(f"Extract job: {job_id}")

    # 3. Poll until terminal status.
    deadline = time.monotonic() + POLL_TIMEOUT_SECONDS
    while True:
        # ``expand`` ensures ``extract_metadata`` (with citations) is populated
        # on the returned job object.
        job = client.extract.get(job_id, expand=["extract_metadata"])
        status = job.status
        print(f"  status: {status}")
        if status in TERMINAL_STATUSES:
            break
        if time.monotonic() > deadline:
            print(
                f"ERROR: extract job {job_id} timed out after {POLL_TIMEOUT_SECONDS}s "
                f"in status {status}.",
                file=sys.stderr,
            )
            return 1
        time.sleep(POLL_INTERVAL_SECONDS)

    if status != "COMPLETED":
        err = getattr(job, "error_message", None) or "(no error message)"
        print(f"ERROR: extract job {job_id} ended in status {status}: {err}", file=sys.stderr)
        return 1

    # 4. Pull extracted data + citation metadata.
    extract_result = job.extract_result
    if extract_result is None:
        print(f"ERROR: extract job {job_id} completed but produced no result.", file=sys.stderr)
        return 1

    # For per_doc the result is a single object (dict). Be defensive in case the
    # SDK returns a list or a nested wrapper.
    if isinstance(extract_result, list):
        data_obj: Any = extract_result[0] if extract_result else {}
    else:
        data_obj = extract_result

    if hasattr(data_obj, "model_dump"):
        data_obj = data_obj.model_dump(mode="json")

    if not isinstance(data_obj, dict):
        print(f"ERROR: unexpected extract_result shape: {type(data_obj)!r}", file=sys.stderr)
        return 1

    data = {field: data_obj.get(field) for field in LEAF_FIELDS}

    # Citation metadata lives on job.extract_metadata.field_metadata.
    raw_field_metadata: Any = None
    if job.extract_metadata is not None:
        em = job.extract_metadata
        if hasattr(em, "model_dump"):
            em = em.model_dump(mode="json")
        if isinstance(em, dict):
            raw_field_metadata = em.get("field_metadata")

    field_metadata = build_field_metadata(raw_field_metadata)

    # 5. Write artifacts.
    write_log(job_id)
    write_result(data, field_metadata)

    print(f"Wrote log: {OUTPUT_LOG_PATH}")
    print(f"Wrote result: {RESULT_JSON_PATH}")
    print("Done.")
    return 0


if __name__ == "__main__":
    sys.exit(main())