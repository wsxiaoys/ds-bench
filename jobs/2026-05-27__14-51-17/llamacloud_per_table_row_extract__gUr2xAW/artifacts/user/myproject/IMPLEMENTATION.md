# LlamaExtract `per_table_row` Extraction Implementation

## Overview
This implementation uses the LlamaCloud TypeScript SDK v2 to extract product data from a multi-page PDF using the `per_table_row` extraction target.

## Implementation Details

### Technology Stack
- **SDK**: `@llamaindex/llama-cloud` v2.4.1 (v2 TypeScript SDK)
- **Schema Validation**: `zod` v3.23.8
- **Runtime**: `tsx` v4.19.2
- **TypeScript**: v5.6.3

### Key Features

1. **Environment Variable Configuration**
   - Reads `LLAMA_CLOUD_API_KEY` for API authentication
   - Reads `ZEALT_RUN_ID` for unique file identification

2. **Schema Definition**
   - Zod schema for single product row with fields:
     - `product_code` (string)
     - `product_name` (string)
     - `category` (string)
     - `price_usd` (number)
     - `stock` (integer)
   - Manual conversion to JSON Schema for Zod v3 compatibility

3. **File Upload**
   - Checks for existing files with same `external_file_id`
   - Uploads PDF with purpose: `extract`
   - Uses `products-${ZEALT_RUN_ID}.pdf` as `external_file_id`

4. **Extraction Configuration**
   - `extraction_target`: `per_table_row`
   - `tier`: `agentic`
   - Processes each table row individually

5. **Job Polling**
   - Polls every 2 seconds
   - Waits for terminal status (COMPLETED, FAILED, or CANCELLED)

6. **Output Generation**
   - Writes JSON array to `/home/user/myproject/output.json`
   - Appends log line to `/home/user/myproject/output.log`
   - Format: `Extracted rows: <N>`

## Results

### Extraction Success
- **Total Rows Extracted**: 12 out of 12 (100%)
- **Processing Time**: ~4 seconds
- **Status**: COMPLETED

### Sample Output
```json
[
  {
    "product_code": "P001",
    "product_name": "Espresso",
    "category": "Beverages",
    "price_usd": 3.5,
    "stock": 100
  },
  ...
  {
    "product_code": "P012",
    "product_name": "Mixed Nuts",
    "category": "Snacks",
    "price_usd": 5.75,
    "stock": 60
  }
]
```

## Acceptance Criteria Met

✅ All 12 product rows extracted successfully
✅ Output is a UTF-8 JSON array
✅ All required fields present with correct types
✅ Log file contains correct row count
✅ Environment variables properly used
✅ Uses v2 SDK as required

## Usage

```bash
cd /home/user/myproject
npx tsx index.ts
```

## Files Created

1. `index.ts` - Main extraction script
2. `output.json` - Extracted product data
3. `output.log` - Execution log