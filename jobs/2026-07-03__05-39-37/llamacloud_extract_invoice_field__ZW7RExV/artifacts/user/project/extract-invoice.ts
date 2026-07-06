/**
 * Extract structured invoice data from a PDF using LlamaCloud Extract v2.
 *
 * Uses the official @llamaindex/llama-cloud SDK (v2) with a Zod-based schema
 * converted to JSON Schema via z.toJSONSchema(...).
 *
 * Usage:  npx tsx extract-invoice.ts
 */

import fs from "node:fs";
import path from "node:path";
import { LlamaCloud, toFile } from "@llamaindex/llama-cloud";
import { z } from "zod";

const INVOICE_PDF = path.join(__dirname, "invoice.pdf");
const OUTPUT_JSON = path.join(__dirname, "output.json");
const OUTPUT_LOG = path.join(__dirname, "output.log");

// ---------------------------------------------------------------------------
// 1. Define the invoice schema with Zod
// ---------------------------------------------------------------------------
const lineItemSchema = z.object({
  description: z.string().describe("Description of the line item / product / service"),
  quantity: z.number().describe("Quantity ordered"),
  unit_price: z.number().describe("Price per unit"),
  total: z.number().describe("Total for this line item (quantity * unit_price)"),
});

const invoiceSchema = z.object({
  invoice_number: z.string().describe("The unique invoice number / identifier"),
  invoice_date: z
    .string()
    .describe("Invoice date in ISO YYYY-MM-DD format if possible"),
  vendor_name: z.string().describe("Name of the vendor / supplier issuing the invoice"),
  total_amount: z
    .number()
    .describe("The grand total amount of the invoice in the invoice's currency"),
  line_items: z.array(lineItemSchema).describe("Itemised list of charges on the invoice"),
});

// Convert the Zod schema into a JSON Schema object accepted by the API.
const dataSchema = z.toJSONSchema(invoiceSchema) as Record<string, unknown>;

// ---------------------------------------------------------------------------
// 2. LlamaCloud client (reads LLAMA_CLOUD_API_KEY from the environment)
// ---------------------------------------------------------------------------
const client = new LlamaCloud();

// ---------------------------------------------------------------------------
// Helper: poll an extract job until it reaches a terminal state
// ---------------------------------------------------------------------------
const TERMINAL_STATES = new Set(["COMPLETED", "FAILED", "CANCELLED"]);

async function pollUntilTerminal(jobId: string) {
  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
  let job = await client.extract.get(jobId);

  while (!TERMINAL_STATES.has(job.status)) {
    process.stdout.write(
      `  ...job ${jobId} status: ${job.status}. Waiting 5s...\n`
    );
    await sleep(5000);
    job = await client.extract.get(jobId);
  }

  return job;
}

// ---------------------------------------------------------------------------
// 3. Main workflow
// ---------------------------------------------------------------------------
async function main() {
  console.log("=== LlamaCloud Invoice Extractor ===");

  // --- Upload the invoice PDF (purpose: "extract") -------------------------
  console.log(`Uploading ${INVOICE_PDF} ...`);
  const fileBlob = await toFile(fs.readFileSync(INVOICE_PDF), "invoice.pdf", {
    type: "application/pdf",
  });
  const uploaded = await client.files.create({
    file: fileBlob,
    purpose: "extract",
  });
  const fileId = uploaded.id;
  console.log(`  Uploaded file id: ${fileId}`);

  // --- Create the Extract v2 job (agentic tier, per_doc) ------------------
  console.log("Creating Extract v2 job (tier: agentic, extraction_target: per_doc)...");
  const job = await client.extract.create({
    file_input: fileId,
    configuration: {
      data_schema: dataSchema,
      extraction_target: "per_doc",
      tier: "agentic",
    },
  });
  const jobId = job.id;
  console.log(`  Created job id: ${jobId} (initial status: ${job.status})`);

  // --- Poll until terminal ------------------------------------------------
  console.log("Polling for completion...");
  const completed = await pollUntilTerminal(jobId);
  console.log(`  Final status: ${completed.status}`);

  if (completed.status !== "COMPLETED") {
    const errMsg = completed.error_message ?? "(no error message provided)";
    throw new Error(`Extract job ${completed.status}: ${errMsg}`);
  }

  // --- Write the parsed extract_result to output.json ---------------------
  const extractResult = completed.extract_result;
  const jsonText = JSON.stringify(extractResult, null, 2);
  fs.writeFileSync(OUTPUT_JSON, jsonText + "\n", "utf-8");
  console.log(`Wrote parsed result to ${OUTPUT_JSON}`);

  // --- Build & append the one-line summary to output.log ------------------
  // extract_result is a single object for per_doc extraction.
  const resultObj = (Array.isArray(extractResult) ? extractResult[0] : extractResult) as
    | Record<string, unknown>
    | null;

  const invoiceNumber = (resultObj?.invoice_number as string) ?? "UNKNOWN";
  const vendorName = (resultObj?.vendor_name as string) ?? "UNKNOWN";
  const totalAmount = (resultObj?.total_amount as number) ?? "UNKNOWN";

  const summaryLine = `Extracted Invoice: ${invoiceNumber} | Vendor: ${vendorName} | Total: ${totalAmount}`;

  // Idempotent: overwrite output.log on every run.
  fs.writeFileSync(OUTPUT_LOG, summaryLine + "\n", "utf-8");
  console.log(`Wrote summary to ${OUTPUT_LOG}:`);
  console.log(`  ${summaryLine}`);
}

main().catch((err) => {
  console.error("Extract failed:", err);
  process.exit(1);
});