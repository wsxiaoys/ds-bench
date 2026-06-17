# Async Batch Extraction with LlamaCloud

This script performs concurrent batch extraction of invoice PDFs using LlamaCloud's Extract API with the v2 SDK.

## Setup

1. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

2. Set environment variables:
   ```bash
   export LLAMA_CLOUD_API_KEY="your-api-key"
   export ZEALT_RUN_ID="your-run-id"
   ```

## Usage

Run the extraction script:
```bash
cd /home/user/myproject
python extract_invoices.py
```

## Output

- `results.json` - JSON object mapping original filename to extracted invoice data
- `output.log` - Log file with extract job status entries

## Invoice Schema

The extraction uses the following Pydantic schema:
- `vendor_name` (string)
- `invoice_number` (string)
- `total_amount` (number)
- `line_items` (list of strings)

## Concurrency

The script uses an `asyncio.Semaphore` to bound concurrent extraction jobs to at most 3 simultaneous in-flight jobs.