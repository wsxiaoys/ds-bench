import { createReadStream } from "fs";
import { promises as fs } from "fs";
import path from "path";
import { LlamaCloud } from "@llamaindex/llama-cloud";
import { z } from "zod";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const invoiceSchema = z.object({
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

const run = async () => {
  const client = new LlamaCloud();
  const invoicePath = path.join("/home/user/project", "invoice.pdf");

  const uploaded = await client.files.create({
    file: createReadStream(invoicePath),
    purpose: "extract",
  });

  const job = await client.extract.create({
    file_input: uploaded.id,
    configuration: {
      data_schema: z.toJSONSchema(invoiceSchema),
      extraction_target: "per_doc",
      tier: "agentic",
    },
  });

  const terminalStatuses = new Set(["COMPLETED", "FAILED", "CANCELLED"]);
  let currentJob = job;

  while (!terminalStatuses.has(currentJob.status)) {
    await sleep(2000);
    currentJob = await client.extract.get(currentJob.id);
  }

  if (currentJob.status !== "COMPLETED") {
    throw new Error(
      `Extraction job ended with status ${currentJob.status}: ${currentJob.error_message ?? "Unknown error"}`
    );
  }

  const extractResult = currentJob.extract_result ?? {};
  const outputJsonPath = path.join("/home/user/project", "output.json");
  const outputLogPath = path.join("/home/user/project", "output.log");

  await fs.writeFile(outputJsonPath, JSON.stringify(extractResult, null, 2));

  const summaryLine = `Extracted Invoice: ${String(
    (extractResult as { invoice_number?: string }).invoice_number ?? ""
  )} | Vendor: ${String(
    (extractResult as { vendor_name?: string }).vendor_name ?? ""
  )} | Total: ${String(
    (extractResult as { total_amount?: number }).total_amount ?? ""
  )}`;

  await fs.writeFile(outputLogPath, "");
  await fs.appendFile(outputLogPath, `${summaryLine}\n`);
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
