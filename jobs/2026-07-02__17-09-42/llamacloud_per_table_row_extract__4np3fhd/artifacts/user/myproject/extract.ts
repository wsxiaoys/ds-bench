// LlamaExtract `per_table_row` extraction pipeline.
//
// Uses the v2 LlamaCloud TypeScript SDK (@llamaindex/llama-cloud) to exhaustively
// extract every row of a multi-page product catalog PDF.

import { createReadStream } from "node:fs";
import { appendFile, writeFile } from "node:fs/promises";
import { setTimeout as sleep } from "node:timers/promises";

import LlamaCloud from "@llamaindex/llama-cloud";
import { z, toJSONSchema } from "zod/v4";

// ---------------------------------------------------------------------------
// 1. Environment
// ---------------------------------------------------------------------------

const API_KEY = process.env.LLAMA_CLOUD_API_KEY;
if (!API_KEY) {
  throw new Error(
    "LLAMA_CLOUD_API_KEY is not set in the environment. Aborting."
  );
}

const RUN_ID = (await import("node:fs/promises")).readFile(
  "/logs/artifacts/run-id",
  "utf8"
).then((s) => s.trim());
const runId = await RUN_ID;

const PDF_PATH = "/home/user/myproject/data/products.pdf";
const OUTPUT_JSON = "/home/user/myproject/output.json";
const OUTPUT_LOG = "/home/user/myproject/output.log";

// ---------------------------------------------------------------------------
// 2. Zod schema for a single product row
// ---------------------------------------------------------------------------
//
// LlamaExtract's `per_table_row` extraction_target applies this schema to each
// repeating row in the document and returns a JSON array. Keeping the fields
// flat and scalar improves extraction reliability.

const ProductRowSchema = z.object({
  product_code: z.string().describe(
    "The unique product code, e.g. P001"
  ),
  product_name: z.string().describe(
    "The product name"
  ),
  category: z.string().describe(
    "The product category, e.g. Beverages or Snacks"
  ),
  price_usd: z.number().describe(
    "The unit price in USD"
  ),
  stock: z.int().describe(
    "The stock count (integer)"
  ),
});

const data_schema = toJSONSchema(ProductRowSchema);

// ---------------------------------------------------------------------------
// 3. LlamaCloud client
// ---------------------------------------------------------------------------

const client = new LlamaCloud({ apiKey: API_KEY });

// ---------------------------------------------------------------------------
// 4. Upload the PDF
// ---------------------------------------------------------------------------

console.log(`Uploading ${PDF_PATH} with external_file_id=products-${runId}.pdf …`);
const uploaded = await client.files.create({
  file: createReadStream(PDF_PATH),
  purpose: "extract",
  external_file_id: `products-${runId}.pdf`,
});
console.log("Uploaded file id:", uploaded.id);

// ---------------------------------------------------------------------------
// 5. Submit the extraction job
// ---------------------------------------------------------------------------

console.log("Submitting extraction job (per_table_row, agentic) …");
const job = await client.extract.create({
  file_input: uploaded.id,
  configuration: {
    data_schema,
    extraction_target: "per_table_row",
    tier: "agentic",
  },
});
console.log("Created extraction job id:", job.id, "status:", job.status);

// ---------------------------------------------------------------------------
// 6. Poll until terminal status
// ---------------------------------------------------------------------------

const TERMINAL = new Set(["COMPLETED", "FAILED", "CANCELLED"]);

let current = job;
while (!TERMINAL.has(current.status)) {
  await sleep(2000);
  current = await client.extract.get(job.id);
  console.log(`  status=${current.status}`);
}

if (current.status !== "COMPLETED") {
  throw new Error(
    `Extraction job ${job.id} ended in non-success status ${current.status}: ${current.error_message ?? "(no error message)"}`
  );
}

const result = current.extract_result;
if (!Array.isArray(result)) {
  throw new Error(
    `Expected extract_result to be a JSON array for per_table_row, got: ${typeof result}`
  );
}

console.log(`Extraction completed with ${result.length} rows.`);

// ---------------------------------------------------------------------------
// 7. Persist results
// ---------------------------------------------------------------------------

await writeFile(OUTPUT_JSON, JSON.stringify(result, null, 2) + "\n", "utf8");
await appendFile(OUTPUT_LOG, `Extracted rows: ${result.length}\n`, "utf8");

console.log(`Wrote ${OUTPUT_JSON} and appended row count to ${OUTPUT_LOG}.`);
