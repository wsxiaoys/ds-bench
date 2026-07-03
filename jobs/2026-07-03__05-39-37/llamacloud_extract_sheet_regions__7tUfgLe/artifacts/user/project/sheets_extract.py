"""Extract tabular regions from an Excel workbook using LlamaCloud's beta.sheets API.

Steps:
  1. Upload the workbook via the Files API with purpose="parse".
  2. Run a LlamaSheets job requesting additional worksheet metadata.
  3. Wait for the job to complete (the one-shot `parse` helper polls).
  4. For every detected region, download the Parquet result table to
     /home/user/project/output/region_<region_id>.parquet.
  5. Write a structured summary to /home/user/project/output/sheets.log.
"""

import os
import sys
import time
import urllib.request

from llama_cloud import LlamaCloud

# --------------------------------------------------------------------------- #
# Paths / constants
# --------------------------------------------------------------------------- #
BASE_DIR = "/home/user/project"
INPUT_FILE = os.path.join(BASE_DIR, "data", "sales.xlsx")
OUTPUT_DIR = os.path.join(BASE_DIR, "output")
LOG_FILE = os.path.join(OUTPUT_DIR, "sheets.log")


def _download(url: str, dest: str) -> None:
    """Stream the bytes at `url` to `dest` using urllib."""
    with urllib.request.urlopen(url) as resp, open(dest, "wb") as fh:
        while True:
            chunk = resp.read(1 << 14)  # 16 KiB chunks
            if not chunk:
                break
            fh.write(chunk)


def main() -> int:
    # The LlamaCloud client picks up LLAMA_CLOUD_API_KEY from the environment
    # REDACTEDmatically; surface a clear error if it is missing.
    if not os.environ.get("LLAMA_CLOUD_API_KEY"):
        print("ERROR: LLAMA_CLOUD_API_KEY environment variable is not set.", file=sys.stderr)
        return 2

    if not os.path.isfile(INPUT_FILE):
        print(f"ERROR: input file not found: {INPUT_FILE}", file=sys.stderr)
        return 2

    os.makedirs(OUTPUT_DIR, exist_ok=True)

    client = LlamaCloud()

    # 1. Upload the workbook for parsing.
    with open(INPUT_FILE, "rb") as fh:
        file_obj = client.files.create(file=fh, purpose="parse")
    file_id = file_obj.id
    print(f"Uploaded file -> file_id={file_id}")

    # 2. Run the LlamaSheets job (polls until completion) with additional metadata.
    job = client.beta.sheets.parse(
        file_id=file_id,
        config={"generate_additional_metadata": True},
    )

    job_id = job.id
    job_status = job.status
    regions = job.regions or []
    print(f"Job finished -> id={job_id} status={job_status} regions={len(regions)}")

    if job_status != "SUCCESS":
        print(f"ERROR: job did not succeed (status={job_status}, errors={job.errors})",
              file=sys.stderr)
        return 1

    # 3. Download the Parquet artifact for every detected region.
    log_lines = [
        f"Job ID: {job_id}",
        f"Job Status: SUCCESS",
        f"Region Count: {len(regions)}",
    ]

    for region in regions:
        region_id = region.region_id
        sheet_name = region.sheet_name
        location = region.location

        parquet_path = os.path.join(OUTPUT_DIR, f"region_{region_id}.parquet")

        # Fetch a presigned download URL for this region's Parquet table.
        result = client.beta.sheets.get_result_table(
            region_type=region.region_type,
            spreadsheet_job_id=job_id,
            region_id=region_id,
        )
        _download(result.url, parquet_path)
        print(f"Downloaded region {region_id} -> {parquet_path}")

        log_lines.append(
            f"Region: {region_id} sheet={sheet_name} location={location}"
        )
        log_lines.append(f"Parquet: {parquet_path}")

    # 4. Write the structured summary log.
    with open(LOG_FILE, "w") as fh:
        fh.write("\n".join(log_lines) + "\n")
    print(f"Wrote log -> {LOG_FILE}")

    return 0


if __name__ == "__main__":
    sys.exit(main())