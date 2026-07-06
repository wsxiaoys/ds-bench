import fs from 'fs';
import path from 'path';
import { z } from 'zod';
import LlamaCloud from '@llamaindex/llama-cloud';

// 1. Define the Zod schema for an invoice
const InvoiceSchema = z.object({
  invoice_number: z.string().describe("The unique invoice number/ID"),
  invoice_date: z.string().describe("The date of the invoice, ISO-formatted YYYY-MM-DD if possible"),
  vendor_name: z.string().describe("The name of the vendor/issuer of the invoice"),
  total_amount: z.number().describe("The grand total amount in the invoice's currency"),
  line_items: z.array(
    z.object({
      description: z.string().describe("Description of the line item"),
      quantity: z.number().describe("Quantity of the item"),
      unit_price: z.number().describe("Unit price of the item"),
      total: z.number().describe("Total cost for this line item"),
    })
  ).describe("List of individual line items in the invoice"),
});

async function main() {
  const apiKey = process.env.LLAMA_CLOUD_API_KEY;
  if (!apiKey) {
    console.error("Error: LLAMA_CLOUD_API_KEY environment variable is not set.");
    process.exit(1);
  }

  // Initialize the LlamaCloud client
  const client = new LlamaCloud({
    apiKey,
  });

  const invoicePath = '/home/user/project/invoice.pdf';
  if (!fs.existsSync(invoicePath)) {
    console.error(`Error: Input invoice file not found at ${invoicePath}`);
    process.exit(1);
  }

  console.log(`Uploading ${invoicePath} to LlamaCloud...`);
  // 2. Upload the file with purpose "extract"
  const file = await client.files.create({
    file: fs.createReadStream(invoicePath),
    purpose: 'extract',
  });

  console.log(`File uploaded successfully. File ID: ${file.id}`);

  // Convert Zod schema to JSON schema using the native v4 z.toJSONSchema method
  // @ts-ignore
  const jsonSchema = z.toJSONSchema(InvoiceSchema);
  console.log("Converted Zod schema to JSON Schema.");

  console.log("Starting Extract v2 job...");
  // 3. Start the extraction job with flattened configuration
  let job = await client.extract.create({
    file_input: file.id,
    configuration: {
      data_schema: jsonSchema as any,
      extraction_target: 'per_doc',
      tier: 'agentic',
    },
  });

  console.log(`Extract job created. Job ID: ${job.id}. Current status: ${job.status}`);

  // 4. Poll until the job is in a terminal state (COMPLETED, FAILED, or CANCELLED)
  while (job.status === 'PENDING' || job.status === 'RUNNING') {
    console.log(`Job status: ${job.status}. Polling in 5 seconds...`);
    await new Promise((resolve) => setTimeout(resolve, 5000));
    job = await client.extract.get(job.id);
  }

  console.log(`Job reached terminal state: ${job.status}`);

  if (job.status === 'COMPLETED') {
    const result = job.extract_result;
    if (!result) {
      console.error("Error: Job completed but no extract_result was returned.");
      process.exit(1);
    }

    // 5. Write the pretty-printed JSON extract_result to output.json
    const outputPath = '/home/user/project/output.json';
    fs.writeFileSync(outputPath, JSON.stringify(result, null, 2), 'utf8');
    console.log(`Successfully wrote extracted data to ${outputPath}`);

    // Safely extract the fields for the summary
    // Since result is parsed JSON, we can access its fields.
    // Let's cast it or access properties dynamically.
    const typedResult = result as any;
    const invoiceNumber = typedResult.invoice_number || 'N/A';
    const vendorName = typedResult.vendor_name || 'N/A';
    const totalAmount = typedResult.total_amount !== undefined ? typedResult.total_amount : 'N/A';

    // 6. Overwrite the one-line summary in output.log
    const logPath = '/home/user/project/output.log';
    const logLine = `Extracted Invoice: ${invoiceNumber} | Vendor: ${vendorName} | Total: ${totalAmount}\n`;
    fs.writeFileSync(logPath, logLine, 'utf8');
    console.log(`Successfully wrote summary to ${logPath}`);
  } else {
    console.error(`Extraction failed or was cancelled. Status: ${job.status}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("An unexpected error occurred:", err);
  process.exit(1);
});
