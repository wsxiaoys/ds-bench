/**
 * Extract structured invoice data from a PDF using LlamaCloud Extract v2.
 *
 * Pipeline:
 *   1. Define a Zod schema for the invoice (converted to JSON Schema via z.toJSONSchema).
 *   2. Upload `invoice.pdf` to LlamaCloud with purpose "extract".
 *   3. Create an Extract v2 job with the agentic tier + per_doc target.
 *   4. Poll the job until it reaches a terminal state (COMPLETED / FAILED / CANCELLED).
 *   5. Write the parsed extract_result to output.json and a one-line summary to output.log.
 *
 * Run with:
 *   npx tsx extract_invoice.ts
 *
 * The SDK picks up LLAMA_CLOUD_API_KEY from the environment REDACTEDmatically, so no
 * API key needs to be hard-coded here.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { LlamaCloud, toFile } from "@llamaindex/llama-cloud";
import { z } from "zod";

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------
const PROJECT_DIR = "/home/user/project";
const INVOICE_PATH = path.join(PROJECT_DIR, "invoice.pdf");
const OUTPUT_JSON_PATH = path.join(PROJECT_DIR, "output.json");
const OUTPUT_LOG_PATH = path.join(PROJECT_DIR, "output.log");

// ---------------------------------------------------------------------------
// Zod schema describing the invoice fields we want to extract
// ---------------------------------------------------------------------------
const LineItemSchema = z.object({
  description: z.string(),
  quantity: z.number(),
  unit_price: z.number(),
  total: z.number(),
});

const InvoiceSchema = z.object({
  invoice_number: z.string(),
  invoice_date: z.string(), // ISO-formatted YYYY-MM-DD when possible
  vendor_name: z.string(),
  total_amount: z.number(), // grand total in the invoice's currency
  line_items: z.array(LineItemSchema),
});

type Invoice = z.infer<typeof InvoiceSchema>;

// Terminal job states we should stop polling on.
const TERMINAL_STATUSES = new Set(["COMPLETED", "FAILED", "CANCELLED"]);

const POLL_INTERVAL_MS = 2_000;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Extract a single (non-array) record from `extract_result` regardless of the
 * extraction_target that was used. With `extraction_target: "per_doc"` the API
 * returns a single object; with "per_page" / "per_table_row" it returns an
 * array. We normalize to the first record for the summary line.
 */
function pickRecord(result: unknown): Record<string, unknown> | null {
  if (result == null) return null;
  if (Array.isArray(result)) {
    return (result[0] as Record<string, unknown> | undefined) ?? null;
  }
  if (typeof result === "object") {
    return result as Record<string, unknown>;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main(): Promise<void> {
  if (!fs.existsSync(INVOICE_PATH)) {
    throw new Error(`Input PDF not found at ${INVOICE_PATH}`);
  }

  // SDK reads LLAMA_CLOUD_API_KEY from the environment REDACTEDmatically.
  const client = new LlamaCloud();

  // ---- 1. Upload the PDF with purpose "extract" --------------------------------
  console.log(`[extract] Uploading ${INVOICE_PATH} …`);
  const uploaded = await client.files.create({
    file: await toFile(fs.createReadStream(INVOICE_PATH), "invoice.pdf"),
    purpose: "extract",
  });
  console.log(`[extract] Uploaded file: id=${uploaded.id}, name=${uploaded.name}`);

  // ---- 2. Convert Zod schema to JSON Schema and kick off the Extract v2 job -----
  const data_schema = z.toJSONSchema(InvoiceSchema) as unknown as Record<
    string,
    unknown
  >;

  const created = await client.extract.create({
    file_input: uploaded.id,
    configuration: {
      data_schema,
      tier: "agentic",
      extraction_target: "per_doc",
    },
  });

  console.log(
    `[extract] Created extraction job: id=${created.id}, status=${created.status}`
  );

  // ---- 3. Poll until the job reaches a terminal status ------------------------
  let job = created;
  while (!TERMINAL_STATUSES.has(job.status)) {
    await sleep(POLL_INTERVAL_MS);
    job = await client.extract.get(job.id);
    console.log(`[extract] Polling job ${job.id}: status=${job.status}`);
  }

  if (job.status !== "COMPLETED") {
    throw new Error(
      `Extraction job ${job.id} ended in terminal status=${job.status}` +
        (job.error_message ? `: ${job.error_message}` : "")
    );
  }

  const extractResult = job.extract_result;

  // ---- 4. Pretty-print extract_result to output.json --------------------------
  // The script is idempotent: overwrite on every run.
  fs.writeFileSync(
    OUTPUT_JSON_PATH,
    JSON.stringify(extractResult ?? null, null, 2) + "\n"
  );

  // ---- 5. Write the one-line summary to output.log -----------------------------
  const record = pickRecord(extractResult);
  if (record == null) {
    throw new Error(
      `Extraction job ${job.id} completed but produced an empty extract_result.`
    );
  }

  const invoiceNumber = String(record.invoice_number ?? "");
  const vendorName = String(record.vendor_name ?? "");
  const totalAmount = (record as Partial<Invoice>).total_amount;

  const summaryLine =
    `Extracted Invoice: ${invoiceNumber} | Vendor: ${vendorName} | Total: ${totalAmount}\n`;

  // Overwrite to make the script idempotent on re-runs.
  fs.writeFileSync(OUTPUT_LOG_PATH, summaryLine);

  console.log(`[extract] Wrote ${OUTPUT_JSON_PATH}`);
  console.log(`[extract] Wrote ${OUTPUT_LOG_PATH}: ${summaryLine.trim()}`);
}

main().catch((err) => {
  console.error("[extract] Failed:", err);
  process.exit(1);
});
