import fs from "node:fs";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import LlamaCloud, { toFile } from "@llamaindex/llama-cloud";
import { z, toJSONSchema } from "zod/v4";

// ---------------------------------------------------------------------------
// Configuration: read API key + run id before anything else
// ---------------------------------------------------------------------------

const API_KEY = process.env.LLAMA_CLOUD_API_KEY;
if (!API_KEY) {
  throw new Error("LLAMA_CLOUD_API_KEY is not set in the environment");
}

const RUN_ID = fs.readFileSync("/logs/artifacts/run-id", "utf8").trim();
if (!RUN_ID) {
  throw new Error("Run ID file /logs/artifacts/run-id is empty");
}

const PROJECT_DIR = "/home/user/myproject";
const PDF_PATH = path.join(PROJECT_DIR, "data", "products.pdf");
const OUTPUT_JSON = path.join(PROJECT_DIR, "output.json");
const OUTPUT_LOG = path.join(PROJECT_DIR, "output.log");
const EXTERNAL_FILE_ID = `products-${RUN_ID}.pdf`;

// ---------------------------------------------------------------------------
// Schema: describes a SINGLE product row (per_table_row applies it repeatedly)
// ---------------------------------------------------------------------------

const productRowSchema = z.object({
  product_code: z.string().describe("The unique product code (e.g. P001)"),
  product_name: z.string().describe("The product name"),
  category: z.string().describe("The product category (e.g. Beverages, Snacks)"),
  price_usd: z.number().describe("The unit price in USD"),
  stock: z.int().describe("The stock count"),
});

const dataSchema = toJSONSchema(productRowSchema);

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

const client = new LlamaCloud({ apiKey: API_KEY });

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TERMINAL_STATUSES = new Set(["COMPLETED", "FAILED", "CANCELLED"]);

async function pollUntilTerminal(jobId: string) {
  for (;;) {
    const job = await client.extract.get(jobId);
    if (TERMINAL_STATUSES.has(job.status)) {
      return job;
    }
    await sleep(2000);
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  // 1. Upload the source PDF (purpose: extract) with a unique external_file_id
  const fileBuffer = fs.readFileSync(PDF_PATH);
  const file = await client.files.create({
    file: await toFile(fileBuffer, "products.pdf", { type: "application/pdf" }),
    purpose: "extract",
    external_file_id: EXTERNAL_FILE_ID,
  });

  // 2. Submit an extraction job with per_table_row target + agentic tier
  const job = await client.extract.create({
    file_input: file.id,
    configuration: {
      data_schema: dataSchema,
      extraction_target: "per_table_row",
      tier: "agentic",
    },
  });

  // 3. Poll until terminal
  const completed = await pollUntilTerminal(job.id);

  if (completed.status !== "COMPLETED") {
    throw new Error(
      `Extraction job ${job.id} ended with status ${completed.status}: ${
        completed.error_message ?? "no error message"
      }`,
    );
  }

  // 4. extract_result is the JSON array of rows
  const rows = Array.isArray(completed.extract_result)
    ? completed.extract_result
    : [];

  if (rows.length < 10) {
    throw new Error(
      `Expected at least 10 extracted rows but got ${rows.length}`,
    );
  }

  const codes = rows.map((r: any) => r?.product_code).filter(Boolean);
  if (!codes.includes("P001") || !codes.includes("P012")) {
    throw new Error(
      `Extracted rows missing P001 or P012. Got codes: ${codes.join(", ")}`,
    );
  }

  // 5. Persist the full result array as pretty-printed UTF-8 JSON
  fs.writeFileSync(OUTPUT_JSON, JSON.stringify(rows, null, 2), "utf8");

  // 6. Append a single human-readable log line
  fs.appendFileSync(OUTPUT_LOG, `Extracted rows: ${rows.length}\n`, "utf8");

  console.log(`Done. Wrote ${rows.length} rows to ${OUTPUT_JSON}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});