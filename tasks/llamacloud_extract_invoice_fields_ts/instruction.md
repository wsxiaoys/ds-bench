# Extract Structured Invoice Data with LlamaCloud (TypeScript + Zod)

## Background
Your finance team has piles of vendor invoices in PDF form. You will build a small Node.js / TypeScript script that uses the LlamaCloud Extract product (v2) with a **Zod**-based schema to pull the key fields out of a single invoice PDF. The script must use the official `@llamaindex/llama-cloud` SDK (v2.x) — **not** the legacy `llama-cloud-services` wrapper.

A sample invoice has already been placed at `/home/user/project/invoice.pdf` for you. Your `LLAMA_CLOUD_API_KEY` is already in the environment.

## Requirements
- Implement a runnable TypeScript script (executable with `npx tsx`) inside `/home/user/project` that:
  - Defines a **Zod** schema for an invoice with the following fields (top-level object):
    - `invoice_number` (string)
    - `invoice_date` (string, ISO-formatted `YYYY-MM-DD` if possible)
    - `vendor_name` (string)
    - `total_amount` (number, the grand total in the invoice's currency)
    - `line_items` (array of objects), where each item has:
      - `description` (string)
      - `quantity` (number)
      - `unit_price` (number)
      - `total` (number)
  - Uploads `invoice.pdf` to LlamaCloud (`purpose: "extract"`).
  - Runs an Extract v2 job with the agentic tier (`tier: "agentic"`, `extraction_target: "per_doc"`) using your Zod schema (converted to JSON Schema via `z.toJSONSchema(...)`).
  - Polls until the job is in a terminal state (`COMPLETED`, `FAILED`, or `CANCELLED`).
  - Writes the parsed `extract_result` object as pretty-printed JSON to `/home/user/project/output.json`.
  - Appends a one-line summary to `/home/user/project/output.log` in **exactly** this format (one line):
    `Extracted Invoice: <invoice_number> | Vendor: <vendor_name> | Total: <total_amount>`

## Implementation Hints
- Install the latest v2 SDK: `npm install @llamaindex/llama-cloud zod`.
- Run the script with `npx tsx <file>.ts` (no separate build step needed).
- Create your TypeScript source file (with a `.ts` extension) directly under `/home/user/project`. Ensure the file contains references to `@llamaindex/llama-cloud`, `zod`, `LlamaCloud`, `extract`, and the input file `invoice.pdf`.
- The SDK reads `LLAMA_CLOUD_API_KEY` from the environment automatically; you do not need to hard-code the key.
- The Extract v2 SDK signature is `client.extract.create({ file_input, configuration: { data_schema, extraction_target, tier } })`. Note the **flattened** `configuration` field — there is no `extract_options` wrapper in v2.
- Use Zod (≥ v4) and `z.toJSONSchema(schema)` to turn your Zod schema into a JSON Schema object that the API accepts as `data_schema`.
- The `extract_result` returned by the SDK is already parsed JSON — write it through `JSON.stringify(result, null, 2)`.
- Make the script idempotent: re-running it should overwrite `output.json` and `output.log`.

