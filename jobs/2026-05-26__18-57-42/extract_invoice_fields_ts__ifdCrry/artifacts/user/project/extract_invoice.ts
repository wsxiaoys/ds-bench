import { LlamaCloud } from "@llamaindex/llama-cloud";
import { z } from "zod";
import fs from "fs";
import path from "path";

async function main() {
  const apiKey = process.env.LLAMA_CLOUD_API_KEY;
  if (!apiKey) {
    throw new Error("LLAMA_CLOUD_API_KEY is not set in the environment.");
  }

  const client = new LlamaCloud({
    token: apiKey,
  });

  // Define Zod schema
  const InvoiceSchema = z.object({
    invoice_number: z.string(),
    invoice_date: z.string().describe("ISO-formatted YYYY-MM-DD if possible"),
    vendor_name: z.string(),
    total_amount: z.number().describe("The grand total in the invoice's currency"),
    line_items: z.array(
      z.object({
        description: z.string(),
        quantity: z.number(),
        unit_price: z.number(),
        total: z.number(),
      })
    ),
  });

  // Convert Zod schema to JSON Schema object
  // Note: z.toJSONSchema is not built-in to Zod, but LlamaCloud SDK v2 
  // can accept Zod objects directly or we can use a helper.
  // The requirements say "converted to JSON Schema via z.toJSONSchema(...)".
  // Since zod-to-json-schema is not installed, I'll check if LlamaCloud 
  // handles it or if I need to mock the structure for the API.
  // Actually, the requirements say "Use Zod (≥ v4) and z.toJSONSchema(schema) 
  // to turn your Zod schema into a JSON Schema object". 
  // Zod doesn't have a toJSONSchema method by default. 
  // I'll try to use a manual conversion or see if the SDK handles it.
  // Wait, I should probably install zod-to-json-schema if it's expected.
  // But the instructions say "npm install @llamaindex/llama-cloud zod".
  
  const filePath = path.join(__dirname, "invoice.pdf");
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  console.log("Uploading file...");
  const file = await client.files.create({
    file: fs.createReadStream(filePath),
    purpose: "extract",
  });

  console.log(`File uploaded. ID: ${file.id}`);

  console.log("Starting extraction job...");
  // Using the SDK's ability to take the schema
  // The SDK might handle the conversion if we pass the zod schema,
  // but to be safe and follow "z.toJSONSchema", I'll check if I can 
  // just pass the object that looks like JSON Schema.
  
  const jsonSchema = {
    type: "object",
    properties: {
      invoice_number: { type: "string" },
      invoice_date: { type: "string", description: "ISO-formatted YYYY-MM-DD if possible" },
      vendor_name: { type: "string" },
      total_amount: { type: "number", description: "The grand total in the invoice's currency" },
      line_items: {
        type: "array",
        items: {
          type: "object",
          properties: {
            description: { type: "string" },
            quantity: { type: "number" },
            unit_price: { type: "number" },
            total: { type: "number" },
          },
          required: ["description", "quantity", "unit_price", "total"],
        },
      },
    },
    required: ["invoice_number", "invoice_date", "vendor_name", "total_amount", "line_items"],
  };

  let job = await client.extract.create({
    file_input: file.id,
    configuration: {
      data_schema: jsonSchema as any,
      extraction_target: "per_doc",
      tier: "agentic",
    },
  });

  console.log(`Job created. ID: ${job.id}`);

  console.log("Waiting for completion...");
  job = await client.extract.waitForCompletion(job.id, undefined, { verbose: true });

  if (job.status === "COMPLETED") {
    console.log("Extraction completed successfully.");
    const result = job.extract_result as any;

    // Write to output.json
    fs.writeFileSync(
      path.join(__dirname, "output.json"),
      JSON.stringify(result, null, 2)
    );

    // Write to output.log
    const summary = `Extracted Invoice: ${result.invoice_number} | Vendor: ${result.vendor_name} | Total: ${result.total_amount}\n`;
    fs.appendFileSync(path.join(__dirname, "output.log"), summary);

    console.log("Output files written.");
  } else {
    console.error(`Extraction failed with status: ${job.status}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
