import { LlamaCloud } from "@llamaindex/llama-cloud";
import { z } from "zod/v4";
import fs from "node:fs";

async function main() {
  const apiKey = process.env.LLAMA_CLOUD_API_KEY;
  const runId = process.env.ZEALT_RUN_ID;

  if (!apiKey) {
    console.error("LLAMA_CLOUD_API_KEY must be set");
    process.exit(1);
  }
  if (!runId) {
    console.error("ZEALT_RUN_ID must be set");
    process.exit(1);
  }

  const client = new LlamaCloud({ apiKey });

  // Define extraction schema for a single product row
  const ProductSchema = z.object({
    product_code: z.string(),
    product_name: z.string(),
    category: z.string(),
    price_usd: z.number(),
    stock: z.number().int(),
  });

  const dataSchema = z.toJSONSchema(ProductSchema);

  const pdfPath = "/home/user/myproject/data/products.pdf";
  const externalFileId = `products-${runId}.pdf`;

  console.log(`Uploading ${pdfPath} as ${externalFileId}...`);
  let file;
  try {
    file = await client.files.create({
      file: fs.createReadStream(pdfPath),
      purpose: "extract",
      external_file_id: externalFileId,
    });
  } catch (err: any) {
    if (err.status === 400 && err.error?.detail?.includes("already exists")) {
      console.log("File already exists, searching for it...");
      const files = await client.files.list({ external_file_id: externalFileId });
      if (files.items.length > 0) {
        file = files.items[0];
      } else {
        throw err;
      }
    } else {
      throw err;
    }
  }

  if (!file) {
    console.error("Failed to get file");
    process.exit(1);
  }

  console.log(`Submitting extraction job for file ${file.id}...`);
  let job = await client.extract.create({
    file_input: file.id,
    configuration: {
      data_schema: dataSchema as any,
      extraction_target: "per_table_row",
      tier: "agentic",
    },
  });

  console.log(`Polling job ${job.id}...`);
  while (true) {
    job = await client.extract.get(job.id);
    console.log(`Status: ${job.status}`);
    if (job.status === "COMPLETED" || job.status === "FAILED" || job.status === "CANCELLED") {
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  if (job.status === "COMPLETED") {
    const result = job.extract_result;
    const outputPath = "/home/user/myproject/output.json";
    const logPath = "/home/user/myproject/output.log";

    fs.writeFileSync(outputPath, JSON.stringify(result, null, 2), "utf-8");
    console.log(`Saved result to ${outputPath}`);

    const rowCount = Array.isArray(result) ? result.length : 0;
    fs.appendFileSync(logPath, `Extracted rows: ${rowCount}\n`, "utf-8");
    console.log(`Logged row count to ${logPath}`);
  } else {
    console.error(`Job failed with status: ${job.status}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
