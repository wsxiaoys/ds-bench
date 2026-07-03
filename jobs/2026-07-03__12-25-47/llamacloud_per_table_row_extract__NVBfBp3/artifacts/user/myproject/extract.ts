import { LlamaCloud } from "@llamaindex/llama-cloud";
import { z, toJSONSchema } from "zod/v4";
import fs from "node:fs";
import path from "node:path";

const PROJECT_DIR = "/home/user/myproject";
const PDF_PATH = path.join(PROJECT_DIR, "data", "products.pdf");
const RUN_ID_PATH = "/logs/artifacts/run-id";
const OUTPUT_JSON_PATH = path.join(PROJECT_DIR, "output.json");
const OUTPUT_LOG_PATH = path.join(PROJECT_DIR, "output.log");

const apiKey = process.env.LLAMA_CLOUD_API_KEY;
if (!apiKey) {
  throw new Error("LLAMA_CLOUD_API_KEY is not set in the environment");
}
const runId = fs.readFileSync(RUN_ID_PATH, "utf8").trim();
console.log(`Using run id: ${runId}`);

const client = new LlamaCloud({ apiKey });

// Define schema for ONE product row.
const ProductRow = z.object({
  product_code: z.string().describe("The unique product code (e.g., P001)"),
  product_name: z.string().describe("The product name"),
  category: z.string().describe("The product category (e.g., Beverages, Snacks)"),
  price_usd: z.number().describe("The unit price in USD"),
  stock: z.number().int().describe("The stock count"),
});

// Convert to JSON Schema (as standard JSON Schema object the API can consume).
const dataSchema = toJSONSchema(ProductRow) as Record<string, unknown>;

// Wrap schema in an object with a defined $schema, type, etc. — strip zod-specific keys if any.
console.log("Data schema:", JSON.stringify(dataSchema, null, 2));

async function main() {
  // 1) Upload the PDF (purpose = "extract").
  const externalFileId = `products-${runId}.pdf`;
  console.log(`Uploading ${PDF_PATH} as ${externalFileId} ...`);
  const uploaded = await client.files.create({
    file: fs.createReadStream(PDF_PATH),
    purpose: "extract",
    external_file_id: externalFileId,
  });
  console.log("Uploaded file:", uploaded.id);

  // 2) Create the extraction job.
  console.log("Creating extraction job...");
  const job = await client.extract.create({
    file_input: uploaded.id,
    configuration: {
      data_schema: dataSchema as any,
      extraction_target: "per_table_row",
      tier: "agentic",
    },
  });
  console.log(`Job created: ${job.id}, status=${job.status}`);

  // 3) Poll until terminal status.
  const TERMINAL = new Set(["COMPLETED", "FAILED", "CANCELLED"]);
  let current = job;
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
  while (!TERMINAL.has(current.status)) {
    await sleep(2000);
    current = await client.extract.get(current.id);
    console.log(`Polling ${current.id}: status=${current.status}`);
  }

  if (current.status !== "COMPLETED") {
    console.error(`Job did not succeed. status=${current.status}`, current.error_message);
    throw new Error(`Extraction failed: ${current.status} ${current.error_message ?? ""}`);
  }

  const result = current.extract_result;
  console.log("Extraction result type:", Array.isArray(result) ? "array" : typeof result);
  if (!Array.isArray(result)) {
    throw new Error("Expected extract_result to be a JSON array (per_table_row mode). Got: " + typeof result);
  }

  console.log(`Extracted ${result.length} rows. First row:`, JSON.stringify(result[0]));
  console.log(`Last row:`, JSON.stringify(result[result.length - 1]));

  // 4) Persist output JSON.
  fs.writeFileSync(OUTPUT_JSON_PATH, JSON.stringify(result, null, 2) + "\n", "utf8");
  console.log(`Wrote ${OUTPUT_JSON_PATH}`);

  // 5) Append human-readable log line.
  fs.appendFileSync(OUTPUT_LOG_PATH, `Extracted rows: ${result.length}\n`, "utf8");
  console.log(`Appended to ${OUTPUT_LOG_PATH}`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
