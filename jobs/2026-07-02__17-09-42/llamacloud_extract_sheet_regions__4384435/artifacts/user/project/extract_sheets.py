"""Use LlamaCloud's beta.sheets API (LlamaSheets) to detect and extract
tabular regions from a spreadsheet, downloading each region as Parquet."""

from __future__ import annotations

import os
import sys
from pathlib import Path

import httpx
from llama_cloud import LlamaCloud

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
PROJECT_ROOT = Path("/home/user/project")
INPUT_FILE = PROJECT_ROOT / "data" / "sales.xlsx"
OUTPUT_DIR = PROJECT_ROOT / "output"
LOG_FILE = OUTPUT_DIR / "sheets.log"


def log(message: str) -> None:
    """Append a line to the structured log file."""
    if not LOG_FILE.exists():
        LOG_FILE.touch()
    with LOG_FILE.open("a", encoding="utf-8") as fh:
        fh.write(message.rstrip("\n") + "\n")


def main() -> int:
    # The synchronous LlamaCloud client picks up LLAMA_CLOUD_API_KEY REDACTEDmatically.
    client = LlamaCloud()

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    # Make sure the log file starts empty so a reviewer can read it cleanly.
    if LOG_FILE.exists():
        LOG_FILE.unlink()
    LOG_FILE.touch()

    # ------------------------------------------------------------------
    # 1. Upload the spreadsheet via the Files API using the `parse` purpose.
    # ------------------------------------------------------------------
    with INPUT_FILE.open("rb") as fh:
        uploaded = client.files.create(file=(INPUT_FILE.name, fh), purpose="parse")
    file_id = uploaded.id
    print(f"[upload] file_id={file_id}")

    # ------------------------------------------------------------------
    # 2. Run the LlamaSheets job (one-shot helper creates + polls).
    # ------------------------------------------------------------------
    job = client.beta.sheets.parse(
        file_id=file_id,
        config={"generate_additional_metadata": True},
    )

    job_id = job.id
    status = job.status
    regions = job.regions or []
    print(f"[job] id={job_id} status={status} regions={len(regions)}")

    log(f"Job ID: {job_id}")
    log(f"Job Status: {status}")
    log(f"Region Count: {len(regions)}")

    if not regions:
        print("No regions detected; exiting.", file=sys.stderr)
        return 1

    # ------------------------------------------------------------------
    # 3. For each detected region, fetch the Parquet URL and stream it to
    #    disk.
    # ------------------------------------------------------------------
    with httpx.Client(timeout=120.0) as http:
        for region in regions:
            region_id = region.region_id
            sheet_name = region.sheet_name
            location = region.location
            parquet_path = OUTPUT_DIR / f"region_{region_id}.parquet"

            presigned = client.beta.sheets.get_result_table(
                region_type=region.region_type,
                spreadsheet_job_id=job_id,
                region_id=region_id,
            )
            response = http.get(presigned.url)
            response.raise_for_status()
            parquet_path.write_bytes(response.content)

            log(f"Region: {region_id} sheet={sheet_name} location={location}")
            log(f"Parquet: {parquet_path}")
            print(f"[region] {region_id} -> {parquet_path} ({len(response.content)} bytes)")

    print("Done.")
    return 0


if __name__ == "__main__":
    sys.exit(main())