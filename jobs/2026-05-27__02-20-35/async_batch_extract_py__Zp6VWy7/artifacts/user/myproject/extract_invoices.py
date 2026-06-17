"""
Async batch invoice extraction with LlamaCloud v2 SDK.

- Uses AsyncLlamaCloud + asyncio
- Bounds concurrency to 3 with asyncio.Semaphore
- Reads API key from LLAMA_CLOUD_API_KEY env var
- Reads run-id from ZEALT_RUN_ID env var
- Uploads PDFs from ./data/ with purpose="extract"
- Creates extract jobs (per_doc, cost_effective) with Pydantic schema
- Polls until COMPLETED/FAILED/CANCELLED
- Writes results.json and appends to output.log
"""

import asyncio
import json
import os
import logging
from pathlib import Path
from typing import List

from pydantic import BaseModel
from llama_cloud import AsyncLlamaCloud

# ── Configuration ────────────────────────────────────────────────────────────
PROJECT_DIR = Path(__file__).parent
DATA_DIR = PROJECT_DIR / "data"
RESULTS_FILE = PROJECT_DIR / "results.json"
LOG_FILE = PROJECT_DIR / "output.log"

PDF_FILES = ["invoice_a.pdf", "invoice_b.pdf", "invoice_c.pdf"]

POLL_INTERVAL = 3          # seconds between status checks
TERMINAL_STATUSES = {"COMPLETED", "FAILED", "CANCELLED"}
MAX_CONCURRENCY = 3

# ── Logging setup ─────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)s  %(message)s",
)
logger = logging.getLogger(__name__)


# ── Pydantic schema ───────────────────────────────────────────────────────────
class InvoiceSchema(BaseModel):
    vendor_name: str
    invoice_number: str
    total_amount: float
    line_items: List[str]


# ── Per-file worker ───────────────────────────────────────────────────────────
async def process_file(
    client: AsyncLlamaCloud,
    filename: str,
    run_id: str,
    semaphore: asyncio.Semaphore,
) -> tuple[str, dict]:
    """Upload one PDF, create an extract job, poll to completion, return result."""

    file_path = DATA_DIR / filename
    stem = Path(filename).stem                      # e.g. "invoice_a"
    external_id = f"{stem}-{run_id}"               # e.g. "invoice_a-zr-zp6vwy7"

    async with semaphore:
        logger.info("Uploading %s (external_file_id=%s)", filename, external_id)

        # 1. Upload file
        with open(file_path, "rb") as fh:
            file_meta = await client.files.create(
                file=fh,
                purpose="extract",
                external_file_id=external_id,
            )
        file_id = file_meta.id
        logger.info("Uploaded %s → file_id=%s", filename, file_id)

        # 2. Create extract job
        schema = InvoiceSchema.model_json_schema()
        job = await client.extract.create(
            file_input=file_id,
            configuration={
                "data_schema": schema,
                "extraction_target": "per_doc",
                "tier": "cost_effective",
            },
        )
        job_id = job.id
        logger.info("Created extract job for %s → job_id=%s", filename, job_id)

    # 3. Poll until terminal (outside semaphore – pure waiting)
    while True:
        job = await client.extract.get(job_id)
        status = job.status
        logger.info("Polling %s (job_id=%s): status=%s", filename, job_id, status)
        if status in TERMINAL_STATUSES:
            break
        await asyncio.sleep(POLL_INTERVAL)

    # 4. Append to output.log
    log_line = f"Extract Job: {filename} {job_id} {status}"
    with open(LOG_FILE, "a") as lf:
        lf.write(log_line + "\n")
    logger.info(log_line)

    # 5. Extract result
    result = {}
    if status == "COMPLETED" and job.extract_result is not None:
        raw = job.extract_result
        # per_doc returns a dict; guard in case it's a list
        if isinstance(raw, list):
            raw = raw[0] if raw else {}
        result = dict(raw)
    else:
        logger.warning("Job %s finished with status=%s; result may be empty.", job_id, status)

    return filename, result


# ── Main ──────────────────────────────────────────────────────────────────────
async def main() -> None:
    api_key = os.environ.get("LLAMA_CLOUD_API_KEY")
    if not api_key:
        raise EnvironmentError("LLAMA_CLOUD_API_KEY environment variable is not set.")

    run_id = os.environ.get("ZEALT_RUN_ID")
    if not run_id:
        raise EnvironmentError("ZEALT_RUN_ID environment variable is not set.")

    semaphore = asyncio.Semaphore(MAX_CONCURRENCY)

    async with AsyncLlamaCloud(api_key=api_key) as client:
        tasks = [
            process_file(client, fname, run_id, semaphore)
            for fname in PDF_FILES
        ]
        results_list = await asyncio.gather(*tasks)

    # Consolidate and persist results
    consolidated: dict[str, dict] = {fname: rec for fname, rec in results_list}
    with open(RESULTS_FILE, "w") as rf:
        json.dump(consolidated, rf, indent=2)

    logger.info("All done. Results written to %s", RESULTS_FILE)


if __name__ == "__main__":
    asyncio.run(main())
