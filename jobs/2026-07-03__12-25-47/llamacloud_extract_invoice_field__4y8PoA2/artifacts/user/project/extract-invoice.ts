import { LlamaCloud } from "@llamaindex/llama-cloud";
import { z, toJSONSchema } from "zod";
import * as fs from "fs";
import * as path from "path";

// Zod schema for an invoice
const InvoiceSchema = z.object({
  invoice_number: z.string(),
  invoice_date: z.string(),
  vendor_name: z.string(),
  total_amount: z.number(),
  line_items: z.array(
    z.object({
      description: z.string(),
      quantity: z.number(),
      unit_price: z.number(),
      total: z.number(),
    })
  ),
});

type Invoice = z.infer<typeof InvoiceSchema>;

async function main() {
  // Construct the LlamaCloud client (reads LLAMA_CLOUD_API_KEY from env)
  const client = new LlamaCloud();

  const inputPath = path.resolve(__dirname, "invoice.pdf");
  const fileBuffer = fs.readFileSync(inputPath);
  const fileBlob = new Blob([fileBuffer], { type: "application/pdf" });

  console.log(`Uploading ${inputPath} to LlamaCloud...`);
  const uploaded = await client.files.create({
    file: new File([fileBlob], "invoice.pdf", { type: "application/pdf" }),
    purpose: "extract",
  });
  console.log(`Uploaded file id: ${uploaded.id}`);

  const dataSchema = toJSONSchema(InvoiceSchema);

  console.log("Creating extract job (agentic tier, per_doc)...");
  const job = await client.extract.create({
    file_input: uploaded.id,
    configuration: {
      data_schema: dataSchema as any,
      extraction_target: "per_doc",
      tier: "agentic",
    },
  });

  console.log(`Job created: ${job.id} (status=${job.status})`);

  // Poll until terminal state
  const TERMINAL = new Set(["COMPLETED", "FAILED", "CANCELLED"]);
  let current = job;
  while (!TERMINAL.has(current.status)) {
    await new Promise((r) => setTimeout(r, 2000));
    current = await client.extract.get(current.id);
    console.log(`Polling: ${current.id} status=${current.status}`);
  }

  if (current.status !== "COMPLETED") {
    throw new Error(
      `Extract job ${current.id} did not complete: status=${current.status}, error=${current.error_message ?? "unknown"}`
    );
  }

  const extractResult = current.extract_result as Invoice | null | undefined;

  // Write pretty-printed JSON to output.json
  fs.writeFileSync(
    path.resolve(__dirname, "output.json"),
    JSON.stringify(extractResult, null, 2)
  );

  // Append summary line to output.log
  const invoiceNumber = extractResult?.invoice_number ?? "UNKNOWN";
  const vendorName = extractResult?.vendor_name ?? "UNKNOWN";
  const totalAmount = extractResult?.total_amount ?? 0;
  const summary = `Extracted Invoice: ${invoiceNumber} | Vendor: ${vendorName} | Total: ${totalAmount}\n`;
  fs.writeFileSync(path.resolve(__dirname, "output.log"), summary);

  console.log("Wrote output.json and output.log");
  console.log(summary.trim());
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
