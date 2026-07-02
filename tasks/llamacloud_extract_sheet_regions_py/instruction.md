# Extract Spreadsheet Regions with LlamaSheets (Python)

## Background
LlamaCloud's `beta.sheets` API (LlamaSheets) intelligently identifies and extracts tabular regions from messy spreadsheets, emitting normalized Parquet files plus rich worksheet/region metadata. You will use the latest **`llama-cloud`** Python SDK (v2.x) to parse a sample Excel workbook, then download the per-region Parquet artifact.

A sample spreadsheet has been prepared at `/home/user/project/data/sales.xlsx`. It contains a single worksheet with a small sales table (region in `A1:D6`) plus an unrelated trailing note further down — exactly the kind of layout LlamaSheets is designed to normalize.

## Requirements
- Read the API key from the `LLAMA_CLOUD_API_KEY` environment variable.
- Upload `data/sales.xlsx` using the Files API with the appropriate `purpose`.
- Run a LlamaSheets job that requests additional metadata (worksheet titles/descriptions).
- Wait for the job to finish, then for **each** detected region download the Parquet table data to `/home/user/project/output/region_<region_id>.parquet`.
- Record a structured summary in `/home/user/project/output/sheets.log` so a reviewer can verify the run from the log alone. The log file must contain the following lines (in any order):
  - `Job ID: <job_id>` — the non-empty LlamaSheets job identifier.
  - `Job Status: SUCCESS`
  - `Region Count: <n>` — the integer number of detected regions (must be `>= 1`).
  - One line per region: `Region: <region_id> sheet=<sheet_name> location=<location>` where `<location>` is the Excel range (e.g., `A1:D6`).
  - One line per region: `Parquet: /home/user/project/output/region_<region_id>.parquet`

## Implementation Hints
- Instantiate the synchronous client with `from llama_cloud import LlamaCloud`. The constructor picks up `LLAMA_CLOUD_API_KEY` automatically.
- Files used for sheet parsing are uploaded via `client.files.create(file=..., purpose="parse")`.
- The one-shot helper `client.beta.sheets.parse(file_id=..., config={"generate_additional_metadata": True})` creates the job, polls until completion, and returns the final job object (`id`, `status`, `regions`, `worksheet_metadata`, ...).
- The Parquet download URL is fetched per region using `client.beta.sheets.get_result_table(region_type=region.region_type, spreadsheet_job_id=<job_id>, region_id=region.region_id)`; perform an HTTP GET on the returned `url` and stream the bytes to disk.
- Make sure the output directory exists before writing files.

