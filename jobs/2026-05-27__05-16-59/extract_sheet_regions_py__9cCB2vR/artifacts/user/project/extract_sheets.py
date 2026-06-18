"""
LlamaSheets extraction script.

Uploads data/sales.xlsx, runs a LlamaSheets job with additional metadata
generation, downloads each detected region as a Parquet file, and writes
a structured summary log to output/sheets.log.
"""

from __future__ import annotations

import os
import sys
import pathlib
import httpx

from llama_cloud import LlamaCloud

# ── Paths ─────────────────────────────────────────────────────────────────────
PROJECT_DIR = pathlib.Path(__file__).parent.resolve()
DATA_FILE   = PROJECT_DIR / "data" / "sales.xlsx"
OUTPUT_DIR  = PROJECT_DIR / "output"
LOG_FILE    = OUTPUT_DIR  / "sheets.log"

# ── Sanity checks ──────────────────────────────────────────────────────────────
if not DATA_FILE.exists():
    sys.exit(f"ERROR: source spreadsheet not found at {DATA_FILE}")

OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

# ── Client ─────────────────────────────────────────────────────────────────────
# API key is read automatically from LLAMA_CLOUD_API_KEY env var
client = LlamaCloud()

# ── Step 1 – Upload the file ───────────────────────────────────────────────────
print(f"[1/4] Uploading {DATA_FILE.name} …")
with DATA_FILE.open("rb") as fh:
    upload = client.files.create(file=fh, purpose="parse")

file_id = upload.id
print(f"      file_id = {file_id}")

# ── Step 2 – Create & await LlamaSheets job ────────────────────────────────────
print("[2/4] Submitting LlamaSheets job (this may take a moment) …")
job = client.beta.sheets.parse(
    file_id=file_id,
    config={"generate_additional_metadata": True},
    verbose=True,
    timeout=300.0,
)

job_id     = job.id
job_status = str(job.status)
regions    = job.regions or []

print(f"      job_id = {job_id}  status = {job_status}  regions = {len(regions)}")

if job_status not in ("SUCCESS", "PARTIAL_SUCCESS"):
    sys.exit(f"ERROR: job finished with unexpected status '{job_status}'. Errors: {job.errors}")

# ── Step 3 – Download per-region Parquet files ─────────────────────────────────
print(f"[3/4] Downloading {len(regions)} region(s) …")

parquet_paths: dict[str, pathlib.Path] = {}

for region in regions:
    region_id = region.region_id or region.location  # fall-back to location if no id
    out_path  = OUTPUT_DIR / f"region_{region_id}.parquet"

    print(f"      region {region_id} ({region.region_type}) @ {region.location} …")

    # Get the presigned URL
    presigned = client.beta.sheets.get_result_table(
        region_type=region.region_type,   # type: ignore[arg-type]
        spreadsheet_job_id=job_id,
        region_id=region_id,
    )

    # Stream the bytes to disk
    with httpx.stream("GET", presigned.url) as resp:
        resp.raise_for_status()
        with out_path.open("wb") as fh:
            for chunk in resp.iter_bytes(chunk_size=65536):
                fh.write(chunk)

    print(f"        → saved {out_path.stat().st_size:,} bytes to {out_path.name}")
    parquet_paths[region_id] = out_path

# ── Step 4 – Write structured log ─────────────────────────────────────────────
print(f"[4/4] Writing log to {LOG_FILE} …")

with LOG_FILE.open("w", encoding="utf-8") as lf:
    lf.write(f"Job ID: {job_id}\n")
    lf.write(f"Job Status: {job_status}\n")
    lf.write(f"Region Count: {len(regions)}\n")

    # Optional worksheet metadata
    if job.worksheet_metadata:
        for ws in job.worksheet_metadata:
            title       = ws.title or ""
            description = ws.description or ""
            lf.write(f"Worksheet: {ws.sheet_name} title={title!r} description={description!r}\n")

    # One line per region (location)
    for region in regions:
        region_id = region.region_id or region.location
        lf.write(
            f"Region: {region_id} sheet={region.sheet_name} location={region.location}\n"
        )

    # One line per region (parquet artifact)
    for region in regions:
        region_id = region.region_id or region.location
        out_path  = parquet_paths[region_id]
        lf.write(f"Parquet: {out_path}\n")

print("\nDone!  Summary:")
print(f"  Job ID     : {job_id}")
print(f"  Status     : {job_status}")
print(f"  Regions    : {len(regions)}")
for region in regions:
    rid = region.region_id or region.location
    print(f"    {rid}  {region.sheet_name}  {region.location}")
print(f"  Log        : {LOG_FILE}")
