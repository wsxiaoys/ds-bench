"""Async batch extraction of invoices with the v2 LlamaCloud SDK.

This script uploads three invoice PDFs in parallel, kicks off one extract
job per file (bounded by an ``asyncio.Semaphore``), waits for all jobs to
reach ``COMPLETED``, and persists the consolidated per-file results to
``results.json`` plus a status log line per job to ``output.log``.
"""

from __future__ import annotations

import asyncio
import json
import os
from pathlib import Path
from typing import Any

from llama_cloud import AsyncLlamaCloud
from pydantic import BaseModel, Field

# ---------------------------------------------------------------------------
# Paths / constants
# ---------------------------------------------------------------------------
DATA_DIR = Path("/home/user/myproject/data")
RESULTS_PATH = Path("/home/user/myproject/results.json")
LOG_PATH = Path("/home/user/myproject/output.log")
RUN_ID_PATH = Path("/logs/artifacts/run-id")

PDF_FILENAMES = ["invoice_a.pdf", "invoice_b.pdf", "invoice_c.pdf"]

# Bound the number of in-flight LlamaCloud calls; matches the number of files
# so the entire batch can be uploaded/extracted concurrently.
MAX_CONCURRENCY = 3

# Polling interval for extract job status (seconds). LlamaCloud jobs of this
# size usually finish within a few dozen seconds, but we still give the API
# room to breathe to avoid tripping rate limits.
POLL_INTERVAL_SECONDS = 2.0

# Hard ceiling on total wait time per job (15 minutes) so a runaway job
# cannot stall the script forever.
MAX_POLL_SECONDS = 15 * 60


# ---------------------------------------------------------------------------
# Pydantic schema for invoices. ``MyModel.model_json_schema()`` is used to
# derive the JSON-Schema dict that the Extract API expects in
# ``configuration["data_schema"]``.
# ---------------------------------------------------------------------------
class LineItem(BaseModel):
    """A single line item on an invoice."""

    description: str = Field(..., description="Description of the item or service")
    quantity: float | None = Field(default=None, description="Quantity purchased")
    unit_price: float | None = Field(default=None, description="Per-unit price")
    amount: float | None = Field(default=None, description="Total amount for the line")


class InvoiceSchema(BaseModel):
    """Structured representation of an invoice."""

    vendor_name: str = Field(..., description="Name of the issuing vendor")
    invoice_number: str = Field(..., description="Invoice identifier")
    total_amount: float = Field(..., description="Total amount due on the invoice")
    line_items: list[str] = Field(
        default_factory=list,
        description="Free-form descriptions of each line item",
    )


def build_data_schema() -> dict[str, Any]:
    """Return the JSON Schema dict expected by the Extract v2 API."""
    schema = InvoiceSchema.model_json_schema()
    # The Extract API expects the schema to declare an object type at the top
    # level; pydantic already produces that for BaseModel, so we can return it
    # as-is.
    return schema


# ---------------------------------------------------------------------------
# Per-file worker
# ---------------------------------------------------------------------------
async def process_invoice(
    client: AsyncLlamaCloud,
    semaphore: asyncio.Semaphore,
    filename: str,
    run_id: str,
) -> tuple[str, dict[str, Any]]:
    """Upload one invoice PDF, kick off an extract job, wait for it, and
    return ``(filename, extract_result_dict)``.

    All LlamaCloud interactions for this file are guarded by ``semaphore`` so
    we never have more than ``MAX_CONCURRENCY`` calls in flight at once.
    """
    pdf_path = DATA_DIR / filename
    base_id = Path(filename).stem  # "invoice_a" / "invoice_b" / "invoice_c"
    external_file_id = f"{base_id}-{run_id}"

    log_path = LOG_PATH  # captured for the closure

    async def log_line(message: str) -> None:
        # Each job's status line is appended without a leading newline.
        # We open the file per-line so concurrent tasks don't interleave.
        async with asyncio.Lock():  # serialize writes to the log file
            with log_path.open("a", encoding="utf-8") as fh:
                fh.write(message + "\n")

    # 1) Upload the file. Hold the semaphore for the upload so it counts
    # toward the concurrency budget.
    async with semaphore:
        with pdf_path.open("rb") as fh:
            upload = await client.files.create(
                file=(filename, fh, "application/pdf"),
                purpose="extract",
                external_file_id=external_file_id,
            )
        file_id: str = upload.id

    # 2) Create the extract job. The Upload already finished so we don't need
    # the semaphore to throttle it, but the API call is cheap and we still
    # want to bind everything per-file to a single in-flight slot so the
    # overall fan-out is bounded by MAX_CONCURRENCY.
    async with semaphore:
        configuration = {
            "data_schema": build_data_schema(),
            "extraction_target": "per_doc",
            "tier": "cost_effective",
        }
        job = await client.extract.create(
            file_input=file_id,
            configuration=configuration,
        )

    # 3) Poll the job until it reaches a terminal status.
    job_id: str = job.id
    elapsed = 0.0
    while True:
        if job.status in {"COMPLETED", "FAILED", "CANCELLED"}:
            break
        await asyncio.sleep(POLL_INTERVAL_SECONDS)
        elapsed += POLL_INTERVAL_SECONDS
        async with semaphore:
            job = await client.extract.get(job_id)
        if elapsed >= MAX_POLL_SECONDS:
            raise TimeoutError(
                f"Extract job {job_id} for {filename} did not finish within "
                f"{MAX_POLL_SECONDS}s (last status: {job.status})"
            )

    # 4) Record the final status in the log regardless of success/failure,
    # then return the structured result for successful jobs.
    final_status = job.status
    await log_line(f"Extract Job: {filename} {job_id} {final_status}")

    if final_status != "COMPLETED":
        raise RuntimeError(
            f"Extract job {job_id} for {filename} ended with status "
            f"{final_status}: {job.error_message}"
        )

    return filename, dict(job.extract_result or {})


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------
async def main() -> None:
    api_key = os.environ.get("LLAMA_CLOUD_API_KEY")
    if not api_key:
        raise SystemExit("LLAMA_CLOUD_API_KEY environment variable is required")

    run_id = RUN_ID_PATH.read_text(encoding="utf-8").strip()
    if not run_id:
        raise SystemExit(f"Run id file {RUN_ID_PATH} is empty")

    # Reset the run-scoped output log so each invocation gets a clean log.
    LOG_PATH.unlink(missing_ok=True)

    client = AsyncLlamaCloud(api_key=api_key)
    semaphore = asyncio.Semaphore(MAX_CONCURRENCY)

    # Fan out: each task acquires the shared semaphore before any LlamaCloud
    # call so at most MAX_CONCURRENCY jobs are in flight at any time.
    tasks = [
        asyncio.create_task(
            process_invoice(client, semaphore, filename, run_id),
            name=filename,
        )
        for filename in PDF_FILENAMES
    ]

    results_list = await asyncio.gather(*tasks)

    results: dict[str, dict[str, Any]] = {filename: record for filename, record in results_list}

    RESULTS_PATH.write_text(json.dumps(results, indent=2, default=str), encoding="utf-8")
    print(f"Wrote {len(results)} results to {RESULTS_PATH}")


if __name__ == "__main__":
    asyncio.run(main())
