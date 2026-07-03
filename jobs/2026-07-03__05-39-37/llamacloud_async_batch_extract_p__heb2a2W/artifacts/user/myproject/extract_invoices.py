"""
Async batch extraction with LlamaCloud (v2 SDK).

Uploads every PDF in the data directory, kicks off a structured-data extract
job per file, polls for completion, and persists the consolidated results.

Usage:
    python extract_invoices.py
"""

from __future__ import annotations

import asyncio
import json
import os
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field

from llama_cloud import AsyncLlamaCloud

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
DATA_DIR = Path("/home/user/myproject/data")
RESULTS_PATH = Path("/home/user/myproject/results.json")
LOG_PATH = Path("/home/user/myproject/output.log")
RUN_ID_PATH = Path("/logs/artifacts/run-id")

MAX_CONCURRENCY = 3          # at most 3 simultaneous in-flight extract jobs
POLL_INTERVAL = 2.0          # seconds between status polls (avoid rate limits)
POLL_TIMEOUT = 60 * 30       # 30 minutes hard cap per job


# ---------------------------------------------------------------------------
# Pydantic schema describing the structured data we want to extract
# ---------------------------------------------------------------------------
class LineItem(BaseModel):
    """A single line item on an invoice."""

    description: str = Field(..., description="Description of the item or service")
    quantity: Optional[float] = Field(None, description="Quantity billed")
    amount: Optional[float] = Field(None, description="Line total / amount for this item")


class Invoice(BaseModel):
    """Structured representation of an invoice document."""

    vendor_name: str = Field(..., description="Name of the vendor / company issuing the invoice")
    invoice_number: str = Field(..., description="Invoice identifier / number")
    total_amount: float = Field(..., description="Total amount due on the invoice")
    line_items: List[str] = Field(
        default_factory=list,
        description="List of line-item descriptions found on the invoice",
    )


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def read_run_id() -> str:
    """Read the run-id artifact and return it stripped of whitespace."""
    if not RUN_ID_PATH.exists():
        raise FileNotFoundError(f"run-id artifact not found at {RUN_ID_PATH}")
    return RUN_ID_PATH.read_text().strip()


def discover_pdfs() -> List[Path]:
    """Return every PDF in the data directory, sorted for deterministic ordering."""
    if not DATA_DIR.is_dir():
        raise NotADirectoryError(f"data directory not found at {DATA_DIR}")
    pdfs = sorted(DATA_DIR.glob("*.pdf"))
    if not pdfs:
        raise FileNotFoundError(f"no PDF files found in {DATA_DIR}")
    return pdfs


def normalize_extract_result(extract_result: Any) -> Dict[str, Any]:
    """
    ``extract_result`` is a single object for ``per_doc`` extraction, but may
    arrive as a list in some edge cases. Normalise to the schema keys we care
    about, defaulting missing fields to sensible empty values.
    """
    if extract_result is None:
        return {}

    if isinstance(extract_result, list):
        # per_doc should yield one object, but be defensive.
        extract_result = extract_result[0] if extract_result else {}

    if not isinstance(extract_result, dict):
        return {}

    # Keep only the schema-relevant keys, falling back to defaults.
    return {
        "vendor_name": extract_result.get("vendor_name", ""),
        "invoice_number": extract_result.get("invoice_number", ""),
        "total_amount": extract_result.get("total_amount", 0),
        "line_items": extract_result.get("line_items", []) or [],
    }


def append_log_line(line: str) -> None:
    """Append a single line to the output log (created if absent)."""
    with LOG_PATH.open("a", encoding="utf-8") as fh:
        fh.write(line + "\n")


# ---------------------------------------------------------------------------
# Per-file async pipeline
# ---------------------------------------------------------------------------
async def process_one(
    client: AsyncLlamaCloud,
    pdf_path: Path,
    run_id: str,
    schema: Dict[str, Any],
    semaphore: asyncio.Semaphore,
) -> Dict[str, Any]:
    """
    Upload a single PDF, create + poll an extract job, and return the
    normalised extracted record keyed by the original filename.
    """
    original_filename = pdf_path.name
    stem = pdf_path.stem  # e.g. "invoice_a"
    external_file_id = f"{stem}-{run_id}"

    # Bound concurrency for the network-heavy LlamaCloud calls.
    async with semaphore:
        # 1. Upload the file -------------------------------------------------
        with pdf_path.open("rb") as fh:
            uploaded = await client.files.create(
                file=fh,
                purpose="extract",
                external_file_id=external_file_id,
            )
        file_id = uploaded.id
        print(f"[{original_filename}] uploaded -> file_id={file_id} "
              f"(external_file_id={external_file_id})")

        # 2. Create the extract job -----------------------------------------
        configuration = {
            "data_schema": schema,
            "extraction_target": "per_doc",
            "tier": "cost_effective",
        }
        job = await client.extract.create(
            file_input=file_id,
            configuration=configuration,
        )
        job_id = job.id
        print(f"[{original_filename}] extract job created -> job_id={job_id}")

        # 3. Poll until the job reaches a terminal state --------------------
        elapsed = 0.0
        while True:
            job = await client.extract.get(job_id)
            status = job.status
            if status == "COMPLETED":
                break
            if status in ("FAILED", "CANCELLED"):
                raise RuntimeError(
                    f"Extract job {job_id} for {original_filename} "
                    f"ended with status {status}: {job.error_message}"
                )
            if elapsed >= POLL_TIMEOUT:
                raise TimeoutError(
                    f"Extract job {job_id} for {original_filename} "
                    f"timed out after {POLL_TIMEOUT}s (last status={status})"
                )
            await asyncio.sleep(POLL_INTERVAL)
            elapsed += POLL_INTERVAL

        # 4. Normalise the structured result --------------------------------
        record = normalize_extract_result(job.extract_result)

        # 5. Log + return ---------------------------------------------------
        log_line = f"Extract Job: {original_filename} {job_id} {job.status}"
        append_log_line(log_line)
        print(f"[{original_filename}] done -> status={job.status}")

        return {original_filename: record}


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------
async def main() -> None:
    api_key = os.environ.get("LLAMA_CLOUD_API_KEY")
    if not api_key:
        print("ERROR: LLAMA_CLOUD_API_KEY environment variable is not set.", file=sys.stderr)
        sys.exit(1)

    run_id = read_run_id()
    pdf_paths = discover_pdfs()
    schema = Invoice.model_json_schema()

    print(f"run-id         : {run_id}")
    print(f"PDFs to process: {[p.name for p in pdf_paths]}")
    print(f"concurrency    : {MAX_CONCURRENCY} (asyncio.Semaphore)")
    print(f"schema keys    : {list(schema.get('properties', {}).keys())}")

    semaphore = asyncio.Semaphore(MAX_CONCURRENCY)

    # Fan out all per-file tasks concurrently; the semaphore bounds real
    # concurrency to MAX_CONCURRENCY in-flight LlamaCloud operations.
    async with AsyncLlamaCloud(api_key=api_key) as client:
        tasks = [
            process_one(client, pdf, run_id, schema, semaphore)
            for pdf in pdf_paths
        ]
        results_list = await asyncio.gather(*tasks)

    # Consolidate the per-file dicts into a single mapping.
    consolidated: Dict[str, Dict[str, Any]] = {}
    for partial in results_list:
        consolidated.update(partial)

    # Persist the consolidated results.
    RESULTS_PATH.write_text(
        json.dumps(consolidated, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    print(f"\nWrote consolidated results for {len(consolidated)} file(s) -> {RESULTS_PATH}")
    print(f"Appended log lines -> {LOG_PATH}")


if __name__ == "__main__":
    asyncio.run(main())