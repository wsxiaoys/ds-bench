# LlamaExtract `per_table_row` Extraction (TypeScript SDK)

## Background
LlamaCloud's Extract API exposes an `extraction_target` parameter. The default `per_doc` target frequently fails to enumerate **every** entry in long lists/tables because LLMs lose attention on repetitive data; only the first 20–30 items get returned. The `per_table_row` target fixes this by processing each repeating entity individually, returning a JSON array with one element per row.

In this task you must use the **TypeScript SDK (`@llamaindex/llama-cloud`)** to exhaustively extract every row of a multi-page product catalog PDF.

## Requirements
- Use the new v2 LlamaCloud TypeScript SDK (`@llamaindex/llama-cloud` ≥ 2.4) — do **NOT** use the deprecated v1 packages (`llama-cloud-services`, `llamaindex`, etc.).
- Define an extraction schema for a **single** product row (not the entire document) using **Zod** and convert it to JSON Schema with `z.toJSONSchema(...)`.
- The schema must define exactly these fields (all required, no extra fields):
  - `product_code` (string) — the unique product code (e.g., `P001`)
  - `product_name` (string) — the product name
  - `category` (string) — the product category (e.g., `Beverages`, `Snacks`)
  - `price_usd` (number) — the unit price in USD
  - `stock` (integer) — the stock count
- Upload the source PDF `/home/user/myproject/data/products.pdf` with `client.files.create` (purpose `extract`). Use an `external_file_id` of `products-${ZEALT_RUN_ID}.pdf` so concurrent trials never collide.
- Submit an extraction job with `client.extract.create` using the configuration `{ data_schema, extraction_target: "per_table_row", tier: "agentic" }`.
- Poll until the job reaches a terminal status (`COMPLETED`, `FAILED`, or `CANCELLED`).
- On success, write the full extraction result (the JSON array of rows) to `/home/user/myproject/output.json` as pretty-printed UTF-8 JSON.
- Append a single human-readable log line to `/home/user/myproject/output.log` in the format `Extracted rows: <N>` where `<N>` is the number of rows returned.

## Implementation Hints
- Read `process.env.LLAMA_CLOUD_API_KEY` and `process.env.ZEALT_RUN_ID` before doing anything else; both are pre-set in the environment.
- The TypeScript SDK is async-first. Use `await` on every SDK call, and use `fs.createReadStream(...)` (or a `Buffer`) when passing the PDF to `client.files.create`.
- The poll loop should call `client.extract.get(job.id)` and sleep ~2s between attempts; do **not** rely on a separate `waitForCompletion` helper because the response shape differs by version.
- The completed job exposes the rows on `job.extract_result` — which is itself the JSON array you must persist. Do not wrap it in another object.
- Remember that the schema describes one row; LlamaExtract will repeatedly apply it across the document and return a list. Stick to flat scalar fields for reliability.
- Run the script with `npx tsx <entrypoint>.ts` (tsx is preinstalled). No build step is required.

## Acceptance Criteria
- Project path: `/home/user/myproject`
- Ensure the script is executed and the artifacts actually exist (the verifier will load them, not re-run your code).
- Output JSON file: `/home/user/myproject/output.json`
  - Must be a UTF-8 JSON **array** at the top level.
  - Every element must be an object containing **at least** the keys `product_code`, `product_name`, `category`, `price_usd`, and `stock` with the types described above (additional keys are tolerated).
  - The array length must be **≥ 10** (the source PDF contains 12 rows; the verifier allows up to 2 missed rows).
  - The set of `product_code` values must contain both `P001` and `P012` (first and last rows of the table).
- Log file: `/home/user/myproject/output.log`
  - Must contain at least one line matching the format `Extracted rows: <N>` where `<N>` matches the JSON array length.
- Environment variables: the script must read `LLAMA_CLOUD_API_KEY` from the environment and use `ZEALT_RUN_ID` in the uploaded file's `external_file_id`.

