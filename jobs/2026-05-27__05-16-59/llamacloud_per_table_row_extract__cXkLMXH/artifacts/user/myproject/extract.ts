import { LlamaCloud } from "@llamaindex/llama-cloud";
import { z } from "zod/v4";
import * as fs from "fs";
import * as path from "path";

const LLAMA_CLOUD_API_KEY = process.env.LLAMA_CLOUD_API_KEY;
const ZEALT_RUN_ID = process.env.ZEALT_RUN_ID;

if (!LLAMA_CLOUD_API_KEY) {
  throw new Error("LLAMA_CLOUD_API_KEY environment variable is not set");
}
if (!ZEALT_RUN_ID) {
  throw new Error("ZEALT_RUN_ID environment variable is not set");
}

console.log(`Using ZEALT_RUN_ID: ${ZEALT_RUN_ID}`);

// Define schema for a single product row using Zod
const ProductRowSchema = z.object({
  product_code: z.string(),
  product_name: z.string(),
  category: z.string(),
  price_usd: z.number(),
  stock: z.int(),
});

// Convert Zod schema to JSON Schema using z.toJSONSchema
const rawJsonSchema = z.toJSONSchema(ProductRowSchema) as Record<string, unknown>;

// Strip the $schema meta key and additionalProperties constraint —
// LlamaExtract needs a plain JSON Schema without strict mode constraints.
// Also strip numeric bounds on stock (min/max) that can confuse the extractor.
const { $schema: _dollarSchema, additionalProperties: _ap, ...rest } = rawJsonSchema;

const rawProperties = rest.properties as Record<string, Record<string, unknown>>;
const properties: Record<string, Record<string, unknown>> = {};
for (const [key, val] of Object.entries(rawProperties)) {
  // Remove Zod-added numeric bounds that are not needed for extraction
  const { minimum: _min, maximum: _max, ...fieldRest } = val;
  properties[key] = fieldRest;
}

const data_schema = { ...rest, properties };

console.log("JSON Schema:", JSON.stringify(data_schema, null, 2));

const client = new LlamaCloud({ apiKey: LLAMA_CLOUD_API_KEY });

const PDF_PATH = "/home/user/myproject/data/products.pdf";
const OUTPUT_JSON = "/home/user/myproject/output.json";
const OUTPUT_LOG = "/home/user/myproject/output.log";

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  // Step 1: Upload the PDF (or reuse existing file with same external_file_id)
  const externalFileId = `products-${ZEALT_RUN_ID}.pdf`;
  let fileId: string;

  // Check if a file with this external_file_id already exists
  const existing = await client.files.list({ external_file_id: externalFileId });
  if (existing.items && existing.items.length > 0) {
    fileId = existing.items[0].id;
    console.log(`Reusing existing file: id=${fileId}, external_file_id=${externalFileId}`);
  } else {
    console.log("Uploading PDF...");
    const fileStream = fs.createReadStream(PDF_PATH);
    const uploadedFile = await client.files.create({
      file: fileStream,
      purpose: "extract",
      external_file_id: externalFileId,
    });
    fileId = uploadedFile.id;
    console.log(`File uploaded: id=${fileId}, external_file_id=${externalFileId}`);
  }

  // Step 2: Submit extraction job with per_table_row target
  console.log("Submitting extraction job...");
  const job = await client.extract.create({
    file_input: fileId,
    configuration: {
      data_schema: data_schema as Record<string, Record<string, unknown> | unknown[] | string | number | boolean | null>,
      extraction_target: "per_table_row",
      tier: "agentic",
    },
  });

  console.log(`Extraction job created: id=${job.id}, status=${job.status}`);

  // Step 3: Poll until terminal status
  const TERMINAL_STATUSES = new Set(["COMPLETED", "FAILED", "CANCELLED"]);
  let currentJob = job;

  while (!TERMINAL_STATUSES.has(currentJob.status)) {
    console.log(`Job status: ${currentJob.status} — polling again in 2s...`);
    await sleep(2000);
    currentJob = await client.extract.get(currentJob.id);
  }

  console.log(`Job reached terminal status: ${currentJob.status}`);

  if (currentJob.status !== "COMPLETED") {
    const errorMsg = currentJob.error_message ?? "Unknown error";
    throw new Error(`Extraction job ${currentJob.status}: ${errorMsg}`);
  }

  // Step 4: Persist results
  const extractResult = currentJob.extract_result;

  if (!Array.isArray(extractResult)) {
    throw new Error(
      `Expected extract_result to be an array (per_table_row), got: ${typeof extractResult}`
    );
  }

  const rows = extractResult as Array<Record<string, unknown>>;
  const rowCount = rows.length;

  console.log(`Extraction complete. Rows extracted: ${rowCount}`);

  // Write output.json (pretty-printed UTF-8 JSON array)
  fs.writeFileSync(OUTPUT_JSON, JSON.stringify(rows, null, 2), "utf-8");
  console.log(`Written to ${OUTPUT_JSON}`);

  // Append to output.log
  const logLine = `Extracted rows: ${rowCount}\n`;
  fs.appendFileSync(OUTPUT_LOG, logLine, "utf-8");
  console.log(`Appended to ${OUTPUT_LOG}: ${logLine.trim()}`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
