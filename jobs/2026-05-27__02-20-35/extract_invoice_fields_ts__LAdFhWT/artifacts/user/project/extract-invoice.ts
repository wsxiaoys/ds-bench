import * as fs from "fs";
import * as path from "path";
import { LlamaCloud, toFile } from "@llamaindex/llama-cloud";
import { z } from "zod";

// ---------------------------------------------------------------------------
// 1.  Zod schema for the invoice
// ---------------------------------------------------------------------------
const LineItemSchema = z.object({
  description: z.string(),
  quantity: z.number(),
  unit_price: z.number(),
  total: z.number(),
});

const InvoiceSchema = z.object({
  invoice_number: z.string(),
  invoice_date: z.string().describe("ISO formatted date YYYY-MM-DD if possible"),
  vendor_name: z.string(),
  total_amount: z.number().describe("Grand total in the invoice's currency"),
  line_items: z.array(LineItemSchema),
});

// ---------------------------------------------------------------------------
// 2.  Convert Zod schema → JSON Schema (Zod v4 API)
// ---------------------------------------------------------------------------
const dataSchema = z.toJSONSchema(InvoiceSchema);

// ---------------------------------------------------------------------------
// 3.  Main script
// ---------------------------------------------------------------------------
async function main(): Promise<void> {
  // The SDK reads LLAMA_CLOUD_API_KEY from the environment automatically.
  const client = new LlamaCloud();

  const invoicePath = path.resolve(__dirname ?? ".", "invoice.pdf");
  console.log(`Uploading invoice.pdf from: ${invoicePath}`);

  // -- Upload the file (purpose: "extract") ----------------------------------
  const fileStream = fs.createReadStream(invoicePath);
  const uploadableFile = await toFile(fileStream, "invoice.pdf", {
    type: "application/pdf",
  });

  const uploadedFile = await client.files.create({
    file: uploadableFile,
    purpose: "extract",
  });

  const fileId = uploadedFile.id;
  console.log(`File uploaded. ID: ${fileId}`);

  // -- Create Extract v2 job -------------------------------------------------
  console.log("Creating extraction job (tier: agentic, target: per_doc)...");
  const job = await client.extract.create({
    file_input: fileId,
    configuration: {
      data_schema: dataSchema as Record<string, unknown>,
      extraction_target: "per_doc",
      tier: "agentic",
    },
  });

  const jobId = job.id;
  console.log(`Job created. ID: ${jobId}  Status: ${job.status}`);

  // -- Poll until terminal state ---------------------------------------------
  const TERMINAL = new Set(["COMPLETED", "FAILED", "CANCELLED"]);
  const POLL_INTERVAL_MS = 3_000;
  const MAX_WAIT_MS = 10 * 60 * 1_000; // 10 minutes

  let current = job;
  const start = Date.now();

  while (!TERMINAL.has(current.status)) {
    if (Date.now() - start > MAX_WAIT_MS) {
      throw new Error(`Extraction job ${jobId} did not complete within 10 minutes.`);
    }
    console.log(`  status: ${current.status} — waiting ${POLL_INTERVAL_MS / 1000}s…`);
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    current = await client.extract.get(jobId);
  }

  console.log(`Job finished with status: ${current.status}`);

  if (current.status !== "COMPLETED") {
    throw new Error(
      `Extraction job ${jobId} ended with status ${current.status}: ${current.error_message ?? "(no message)"}`
    );
  }

  if (!current.extract_result) {
    throw new Error(`Job ${jobId} completed but extract_result is empty.`);
  }

  // -- Parse / validate the result with Zod ----------------------------------
  const raw = current.extract_result;
  const parsed = InvoiceSchema.parse(raw);

  // -- Write output.json -----------------------------------------------------
  const outputJsonPath = path.join(path.dirname(invoicePath), "output.json");
  fs.writeFileSync(outputJsonPath, JSON.stringify(parsed, null, 2), "utf-8");
  console.log(`Written: ${outputJsonPath}`);

  // -- Append one-line summary to output.log ---------------------------------
  const summaryLine =
    `Extracted Invoice: ${parsed.invoice_number} | Vendor: ${parsed.vendor_name} | Total: ${parsed.total_amount}`;

  const outputLogPath = path.join(path.dirname(invoicePath), "output.log");
  fs.writeFileSync(outputLogPath, summaryLine + "\n", "utf-8"); // overwrite (idempotent)
  console.log(`Written: ${outputLogPath}`);
  console.log(summaryLine);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
