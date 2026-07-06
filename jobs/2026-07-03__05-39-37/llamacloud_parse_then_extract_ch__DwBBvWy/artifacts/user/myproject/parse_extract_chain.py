"""
Parse-then-Extract chain with the LlamaCloud v2 SDK (`llama-cloud>=2`).

This script demonstrates the recommended end-to-end workflow:
  1. Upload a PDF once (purpose="parse") with a unique external_file_id
     derived from the run-id.
  2. Run an agentic Parse job on the uploaded file and save the first page's
     markdown.
  3. Reuse the parse-job ID (pjb-...) directly as the input to an Extract job
     -- the file is NOT uploaded a second time.
  4. Persist the structured extraction result as JSON and log both job IDs.

The LlamaCloud client reads LLAMA_CLOUD_API_KEY from the environment
REDACTEDmatically.
"""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import List

from pydantic import BaseModel, Field

from llama_cloud import LlamaCloud

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
PROJECT_DIR = Path("/home/user/myproject")
PDF_PATH = PROJECT_DIR / "data" / "invoice.pdf"
PARSED_MD_PATH = PROJECT_DIR / "parsed.md"
EXTRACTED_JSON_PATH = PROJECT_DIR / "extracted.json"
LOG_PATH = PROJECT_DIR / "output.log"
RUN_ID_PATH = Path("/logs/artifacts/run-id")


# ---------------------------------------------------------------------------
# Pydantic schema for the invoice extraction
# ---------------------------------------------------------------------------
class Invoice(BaseModel):
    """Structured schema describing the data to extract from an invoice."""

    vendor: str = Field(..., description="Name of the vendor / company issuing the invoice")
    invoice_number: str = Field(..., description="Invoice identifier / number")
    total_amount: float = Field(..., description="Total amount billed on the invoice")
    line_items: List[str] = Field(
        ..., description="List of line-item descriptions shown on the invoice"
    )


def main() -> None:
    # ----- read run-id and build a unique external_file_id -------------------
    run_id = RUN_ID_PATH.read_text().strip()
    if not run_id:
        raise SystemExit(f"run-id file ({RUN_ID_PATH}) is empty; cannot continue")
    external_file_id = f"invoice-{run_id}"
    assert external_file_id.endswith(run_id), "external_file_id must end with the run-id"

    # ----- initialise the v2 LlamaCloud client -------------------------------
    # The constructor REDACTED-reads LLAMA_CLOUD_API_KEY from the environment.
    client = LlamaCloud()

    # =====================================================================
    # STEP 1 -- Upload the PDF once with purpose="parse"
    # =====================================================================
    print(f"[1/4] Uploading {PDF_PATH} (external_file_id={external_file_id}) ...")
    with open(PDF_PATH, "rb") as fh:
        uploaded = client.files.create(
            file=(PDF_PATH.name, fh, "application/pdf"),
            purpose="parse",
            external_file_id=external_file_id,
        )
    file_id = uploaded.id
    print(f"      Uploaded file id: {file_id}")

    # =====================================================================
    # STEP 2 -- Run an agentic Parse job and capture the parse-job ID
    # =====================================================================
    print("[2/4] Creating agentic parse job (tier=agentic, version=latest) ...")
    parse_job = client.parsing.create(
        tier="agentic",
        version="latest",
        file_id=file_id,
    )
    parse_job_id = parse_job.id
    print(f"      Parse job id: {parse_job_id}")

    # Wait for the parse job to reach a terminal state.
    print("      Waiting for parse job to complete ...")
    client.parsing.wait_for_completion(parse_job_id, verbose=True)

    # Fetch the completed job with markdown expanded.
    parse_result = client.parsing.get(parse_job_id, expand=["markdown"])
    if parse_result.job.status != "COMPLETED":
        raise SystemExit(
            f"Parse job did not complete: status={parse_result.job.status} "
            f"error={parse_result.job.error_message}"
        )
    print(f"      Parse job status: {parse_result.job.status}")

    # Save the markdown of the first page.
    if parse_result.markdown is None or not parse_result.markdown.pages:
        raise SystemExit("Parse result has no markdown pages")
    first_page = parse_result.markdown.pages[0]
    first_page_md = getattr(first_page, "markdown", None)
    if first_page_md is None:
        raise SystemExit(
            f"First page markdown extraction failed: {getattr(first_page, 'error', 'unknown')}"
        )
    PARSED_MD_PATH.write_text(first_page_md, encoding="utf-8")
    print(f"      Saved first-page markdown -> {PARSED_MD_PATH}")

    # =====================================================================
    # STEP 3 -- Reuse the parse-job ID as the input to an Extract job
    #           (the file is NOT uploaded a second time)
    # =====================================================================
    print(f"[3/4] Creating extract job (file_input={parse_job_id}) ...")
    data_schema = Invoice.model_json_schema()
    extract_job = client.extract.create(
        file_input=parse_job_id,
        configuration={
            "data_schema": data_schema,
            "extraction_target": "per_doc",
        },
    )
    extract_job_id = extract_job.id
    print(f"      Extract job id: {extract_job_id}")

    # Wait for the extract job to complete.
    print("      Waiting for extract job to complete ...")
    completed_extract = client.extract.wait_for_completion(extract_job_id, verbose=True)
    if completed_extract.status != "COMPLETED":
        raise SystemExit(
            f"Extract job did not complete: status={completed_extract.status} "
            f"error={completed_extract.error_message}"
        )
    print(f"      Extract job status: {completed_extract.status}")

    # Persist the structured extraction result as JSON.
    extract_result = completed_extract.extract_result
    EXTRACTED_JSON_PATH.write_text(
        json.dumps(extract_result, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )
    print(f"      Saved extraction result -> {EXTRACTED_JSON_PATH}")

    # =====================================================================
    # STEP 4 -- Append single-line summaries for each job to output.log
    # =====================================================================
    print(f"[4/4] Writing job summaries -> {LOG_PATH}")
    log_lines = [
        f"Parse Job ID: {parse_job_id}",
        f"Extract Job ID: {extract_job_id}",
    ]
    with open(LOG_PATH, "a", encoding="utf-8") as log_fh:
        for line in log_lines:
            log_fh.write(line + "\n")

    print("\nDone.")
    print(f"  Parse job id   : {parse_job_id}")
    print(f"  Extract job id : {extract_job_id}")


if __name__ == "__main__":
    main()