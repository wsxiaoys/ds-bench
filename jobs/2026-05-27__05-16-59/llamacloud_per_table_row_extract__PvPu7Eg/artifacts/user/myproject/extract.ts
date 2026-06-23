import fs from "fs";
import { promises as fsp } from "fs";
import LlamaCloud from "@llamaindex/llama-cloud";
import { z } from "zod/v4";

const apiKey = process.env.LLAMA_CLOUD_API_KEY;
const runId = process.env.ZEALT_RUN_ID;

if (!apiKey) {
  throw new Error("LLAMA_CLOUD_API_KEY is required");
}

if (!runId) {
  throw new Error("ZEALT_RUN_ID is required");
}

const client = new LlamaCloud({ apiKey });

const productRowSchema = z
  .object({
    product_code: z.string(),
    product_name: z.string(),
    category: z.string(),
    price_usd: z.number(),
    stock: z.number().int(),
  })
  .strict();

const dataSchema = z.toJSONSchema(productRowSchema);

const pdfPath = "/home/user/myproject/data/products.pdf";
const outputJsonPath = "/home/user/myproject/output.json";
const outputLogPath = "/home/user/myproject/output.log";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const uploadFile = async () => {
  const upload = await client.files.create({
    file: fs.createReadStream(pdfPath),
    purpose: "extract",
    external_file_id: `products-${runId}.pdf`,
  });

  return upload;
};

const runExtract = async () => {
  const upload = await uploadFile();

  const job = await client.extract.create({
    file_input: upload.id,
    configuration: {
      data_schema: dataSchema,
      extraction_target: "per_table_row",
      tier: "agentic",
    },
  });

  let currentJob = job;
  const terminalStatuses = new Set(["COMPLETED", "FAILED", "CANCELLED"]);

  while (!terminalStatuses.has(currentJob.status)) {
    await sleep(2000);
    currentJob = await client.extract.get(job.id);
  }

  if (currentJob.status !== "COMPLETED") {
    throw new Error(`Extraction job ended with status ${currentJob.status}`);
  }

  const rows = currentJob.extract_result ?? [];

  if (!Array.isArray(rows)) {
    throw new Error("Extraction result is not an array");
  }

  await fsp.writeFile(outputJsonPath, JSON.stringify(rows, null, 2), "utf8");
  await fsp.appendFile(outputLogPath, `Extracted rows: ${rows.length}\n`, "utf8");
};

await runExtract();
