import os
import shutil
from pathlib import Path
import urllib.request

from llama_cloud import LlamaCloud


def _safe_get(obj, *names, default=None):
    for name in names:
        if hasattr(obj, name):
            value = getattr(obj, name)
            if value not in (None, ""):
                return value
    return default


def _build_worksheet_map(worksheet_metadata):
    worksheet_map = {}
    if not worksheet_metadata:
        return worksheet_map
    for meta in worksheet_metadata:
        meta_id = _safe_get(meta, "worksheet_id", "id")
        title = _safe_get(meta, "title", "name", "worksheet_name")
        if meta_id and title:
            worksheet_map[meta_id] = title
    return worksheet_map


def _resolve_sheet_name(region, worksheet_map):
    sheet_name = _safe_get(
        region,
        "worksheet_name",
        "sheet_name",
        "worksheet_title",
        "title",
        "worksheet",
    )
    if sheet_name:
        return sheet_name
    worksheet_id = _safe_get(region, "worksheet_id", "sheet_id")
    return worksheet_map.get(worksheet_id, "unknown")


def main():
    input_path = Path("/home/user/project/data/sales.xlsx")
    output_dir = Path("/home/user/project/output")
    output_dir.mkdir(parents=True, exist_ok=True)

    if not input_path.exists():
        raise FileNotFoundError(f"Missing input file: {input_path}")

    api_key = os.getenv("LLAMA_CLOUD_API_KEY")
    if not api_key:
        raise EnvironmentError("LLAMA_CLOUD_API_KEY is not set")

    client = LlamaCloud()

    with input_path.open("rb") as handle:
        uploaded = client.files.create(file=handle, purpose="parse")

    job = client.beta.sheets.parse(
        file_id=uploaded.id,
        config={"generate_additional_metadata": True},
    )

    worksheet_map = _build_worksheet_map(_safe_get(job, "worksheet_metadata", default=[]))
    regions = list(_safe_get(job, "regions", default=[]))

    log_lines = []
    log_lines.append(f"Job ID: {job.id}")
    log_lines.append(f"Job Status: {job.status}")
    log_lines.append(f"Region Count: {len(regions)}")

    if job.status != "SUCCESS":
        raise RuntimeError(f"LlamaSheets job failed: {job.status}")

    downloaded_paths = []
    for region in regions:
        region_id = _safe_get(region, "region_id", "id")
        region_type = _safe_get(region, "region_type", "type")
        location = _safe_get(region, "location", "range", "cell_range")
        sheet_name = _resolve_sheet_name(region, worksheet_map)

        log_lines.append(f"Region: {region_id} sheet={sheet_name} location={location}")

        result = client.beta.sheets.get_result_table(
            region_type=region_type,
            spreadsheet_job_id=job.id,
            region_id=region_id,
        )

        parquet_path = output_dir / f"region_{region_id}.parquet"
        with urllib.request.urlopen(result.url) as response, parquet_path.open("wb") as outfile:
            shutil.copyfileobj(response, outfile)

        if parquet_path.stat().st_size == 0:
            raise RuntimeError(f"Downloaded parquet is empty: {parquet_path}")

        log_lines.append(f"Parquet: {parquet_path}")
        downloaded_paths.append(parquet_path)

    numeric_found = False
    try:
        import pandas as pd

        for parquet_path in downloaded_paths:
            frame = pd.read_parquet(parquet_path)
            numeric_frame = frame.select_dtypes(include="number")
            if not numeric_frame.empty and numeric_frame.notnull().any().any():
                numeric_found = True
                break
    except ImportError:
        import pyarrow.parquet as pq

        for parquet_path in downloaded_paths:
            table = pq.read_table(parquet_path)
            frame = table.to_pandas()
            numeric_frame = frame.select_dtypes(include="number")
            if not numeric_frame.empty and numeric_frame.notnull().any().any():
                numeric_found = True
                break

    if not numeric_found:
        raise RuntimeError("No numeric data found in downloaded parquet files")

    log_path = output_dir / "sheets.log"
    log_path.write_text("\n".join(log_lines) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
