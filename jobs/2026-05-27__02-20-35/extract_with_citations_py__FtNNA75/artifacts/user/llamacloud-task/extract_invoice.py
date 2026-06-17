"""
extract_invoice.py

Upload sample_invoice.txt to LlamaCloud, run a citation-enabled extraction
job, and write the results to result.json and output.log.

Requirements:
  - LLAMA_CLOUD_API_KEY  – LlamaCloud API key (read automatically by SDK)
  - ZEALT_RUN_ID         – run identifier used to build external_file_id
"""

import json
import os
import sys
from pathlib import Path

from llama_cloud import LlamaCloud
from llama_cloud import BadRequestError

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
HERE = Path(__file__).parent
INVOICE_PATH = HERE / "sample_invoice.txt"
OUTPUT_LOG = HERE / "output.log"
RESULT_JSON = HERE / "result.json"

# Schema: JSON Schema for the invoice fields we want to extract
INVOICE_SCHEMA = {
    "type": "object",
    "properties": {
        "company_name": {
            "type": "string",
            "description": "Name of the vendor / company that issued the invoice.",
        },
        "invoice_number": {
            "type": "string",
            "description": "The unique invoice identifier printed on the document.",
        },
        "total_amount": {
            "type": "number",
            "description": "The total amount due (numeric value, no currency symbol).",
        },
    },
    "required": ["company_name", "invoice_number", "total_amount"],
}


def main() -> None:
    # ------------------------------------------------------------------
    # 1. Resolve run-id and build external_file_id
    # ------------------------------------------------------------------
    run_id = os.environ.get("ZEALT_RUN_ID")
    if not run_id:
        print("ERROR: ZEALT_RUN_ID environment variable is not set.", file=sys.stderr)
        sys.exit(1)

    external_file_id = f"invoice-{run_id}.txt"
    print(f"Run ID       : {run_id}")
    print(f"External file: {external_file_id}")

    # ------------------------------------------------------------------
    # 2. Initialise LlamaCloud client (reads LLAMA_CLOUD_API_KEY automatically)
    # ------------------------------------------------------------------
    client = LlamaCloud()

    # ------------------------------------------------------------------
    # 3. Upload invoice file
    # ------------------------------------------------------------------
    print(f"Uploading {INVOICE_PATH} …")
    try:
        with open(INVOICE_PATH, "rb") as fh:
            uploaded_file = client.files.create(
                file=fh,
                purpose="extract",
                external_file_id=external_file_id,
            )
        file_id = uploaded_file.id
        print(f"Uploaded file ID: {file_id}")
    except BadRequestError as exc:
        # The external_file_id already exists in this project (duplicate run).
        # Look it up and reuse the existing file.
        if "duplicate key" in str(exc) or "UniqueViolation" in str(exc):
            print("File already exists for this external_file_id; reusing it …")
            matches = list(client.files.list(external_file_id=external_file_id))
            if not matches:
                raise RuntimeError(
                    f"Could not locate existing file with external_file_id={external_file_id}"
                ) from exc
            file_id = matches[0].id
            print(f"Reusing file ID: {file_id}")
        else:
            raise

    # ------------------------------------------------------------------
    # 4. Submit extraction job
    # ------------------------------------------------------------------
    print("Creating extraction job …")
    job = client.extract.create(
        file_input=file_id,
        configuration={
            "data_schema": INVOICE_SCHEMA,
            "extraction_target": "per_doc",
            "tier": "agentic",
            "cite_sources": True,
        },
    )
    job_id = job.id
    print(f"Extract job  : {job_id}")

    # ------------------------------------------------------------------
    # 5. Poll until terminal status using the built-in helper
    # ------------------------------------------------------------------
    print("Polling for completion …", flush=True)
    completed_job = client.extract.wait_for_completion(
        job_id=job_id,
        polling_interval=2.0,
        max_interval=10.0,
        timeout=600.0,
        verbose=True,
    )
    status = str(completed_job.status)
    print(f"Status       : {status}")

    if status in ("FAILED", "CANCELLED"):
        err = getattr(completed_job, "error_message", None) or "(no details)"
        print(f"ERROR: Extract job ended with status {status}: {err}", file=sys.stderr)
        OUTPUT_LOG.write_text(
            f"Extract job: {job_id}\nStatus: {status}\nError: {err}\n"
        )
        sys.exit(1)

    # ------------------------------------------------------------------
    # 6. Fetch full job (with metadata expanded) and serialise
    # ------------------------------------------------------------------
    # wait_for_completion may not include extract_metadata; re-fetch with
    # the expand parameter to ensure citation data is populated.
    # Note: only "configuration" and "extract_metadata" are valid expand values;
    # extract_result is always returned inline.
    full_job = client.extract.get(job_id, expand=["extract_metadata"])
    job_dict = full_job.model_dump(mode="json")

    # extract_result is a plain dict of {field: value} in SDK v2
    raw_data: dict = job_dict.get("extract_result") or {}

    # extract_metadata shape:
    #   { "field_metadata": { "document_metadata": { field: { "citation": [...], ... } } } }
    raw_meta: dict = job_dict.get("extract_metadata") or {}
    raw_fm: dict = raw_meta.get("field_metadata") or {}
    # The per-document field metadata lives under "document_metadata"
    doc_field_meta: dict = raw_fm.get("document_metadata") or {}

    # Build the output artifact in the shape required by acceptance criteria:
    #   result.json → { "data": {...}, "extract_metadata": { "field_metadata": { field: { "citation": [...] } } } }
    result_artifact = {
        "data": raw_data,
        "extract_metadata": {
            "field_metadata": doc_field_meta,
        },
    }

    # ------------------------------------------------------------------
    # 7. Validate that citations are present for required fields
    # ------------------------------------------------------------------
    required_fields = ("company_name", "invoice_number", "total_amount")
    for field in required_fields:
        if field not in raw_data:
            print(f"WARNING: field '{field}' missing from extracted data.", file=sys.stderr)
        fm_entry = doc_field_meta.get(field, {})
        citations = fm_entry.get("citation", [])
        if not citations:
            print(
                f"WARNING: no citations found for field '{field}'.", file=sys.stderr
            )

    # ------------------------------------------------------------------
    # 8. Write artifacts
    # ------------------------------------------------------------------
    RESULT_JSON.write_text(json.dumps(result_artifact, indent=2, ensure_ascii=False))
    print(f"Wrote {RESULT_JSON}")

    log_lines = [
        f"Extract job: {job_id}",
        f"Status: {status}",
    ]
    OUTPUT_LOG.write_text("\n".join(log_lines) + "\n")
    print(f"Wrote {OUTPUT_LOG}")

    # ------------------------------------------------------------------
    # 9. Quick sanity-print of extracted values and citation summary
    # ------------------------------------------------------------------
    print("\n--- Extracted fields ---")
    print(f"  company_name   : {raw_data.get('company_name')}")
    print(f"  invoice_number : {raw_data.get('invoice_number')}")
    print(f"  total_amount   : {raw_data.get('total_amount')}")

    print("\n--- Citation summary ---")
    for field in required_fields:
        citations = doc_field_meta.get(field, {}).get("citation", [])
        for i, c in enumerate(citations, 1):
            print(f"  {field}[{i}] page={c.get('page')}  text={repr(c.get('matching_text', '')[:60])}")

    print("\nDone.")


if __name__ == "__main__":
    main()
