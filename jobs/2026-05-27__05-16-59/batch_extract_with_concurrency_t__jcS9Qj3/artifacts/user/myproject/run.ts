import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import pLimit from "p-limit";
import { z } from "zod";
import { LlamaCloud } from "@llamaindex/llama-cloud";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const INPUT_DIR = "/home/user/myproject/invoices";
const OUTPUT_LOG = "/home/user/myproject/output.log";
const OUTPUT_RESULTS = "/home/user/myproject/results.json";
const MAX_CONCURRENCY = 3;
const POLL_INTERVAL_MS = 2000;
const JOB_TIMEOUT_MS = 240_000;

const invoiceSchema = z.object({
  vendor_name: z.string().min(1),
  invoice_number: z.string().min(1),
  total_amount: z.number(),
  currency: z.string().length(3)
});

const dataSchema = z.toJSONSchema(invoiceSchema);

type ResultEntry = {
  file: string;
  status: "success" | "error";
  data?: {
    vendor_name: string;
    invoice_number: string;
    total_amount: number;
    currency: string;
  };
  error?: string;
};

const client = new LlamaCloud({
  apiKey: process.env.LLAMA_CLOUD_API_KEY
});

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function walkForPdfs(dir: string): Promise<string[]> {
  const entries = await fs.promises.readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walkForPdfs(fullPath)));
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".pdf")) {
      files.push(fullPath);
    }
  }
  return files;
}

async function pollJob(jobId: string): Promise<any | null> {
  const start = Date.now();
  while (Date.now() - start < JOB_TIMEOUT_MS) {
    const job = await client.extract.get(jobId);
    if (["COMPLETED", "FAILED", "CANCELLED"].includes(job.status)) {
      return job;
    }
    await sleep(POLL_INTERVAL_MS);
  }
  return null;
}

async function processFile(filePath: string): Promise<ResultEntry> {
  const fileName = path.basename(filePath);
  try {
    const uploaded = await client.files.create({
      file: fs.createReadStream(filePath),
      purpose: "extract"
    });

    const job = await client.extract.create({
      file_input: uploaded.id,
      configuration: {
        data_schema: dataSchema,
        extraction_target: "per_doc",
        tier: "cost_effective"
      }
    });

    const finalJob = await pollJob(job.id);
    if (!finalJob) {
      return {
        file: fileName,
        status: "error",
        error: `Timeout waiting for job ${job.id}`
      };
    }

    if (finalJob.status !== "COMPLETED") {
      return {
        file: fileName,
        status: "error",
        error: `Job ${job.id} ended with status ${finalJob.status}`
      };
    }

    const extracted = finalJob.extract_result;
    const parsed = invoiceSchema.safeParse(extracted);
    if (!parsed.success) {
      return {
        file: fileName,
        status: "error",
        error: `Schema validation failed: ${parsed.error.message}`
      };
    }

    return {
      file: fileName,
      status: "success",
      data: parsed.data
    };
  } catch (error) {
    return {
      file: fileName,
      status: "error",
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

async function main() {
  if (!process.env.LLAMA_CLOUD_API_KEY) {
    throw new Error("LLAMA_CLOUD_API_KEY is not set");
  }

  const pdfFiles = await walkForPdfs(INPUT_DIR);
  const limit = pLimit(MAX_CONCURRENCY);
  const results: ResultEntry[] = [];
  const logLines: string[] = [];

  await Promise.all(
    pdfFiles.map((filePath) =>
      limit(async () => {
        const result = await processFile(filePath);
        results.push(result);
        logLines.push(`PROCESSED ${result.file}: ${result.status}`);
      })
    )
  );

  const successCount = results.filter((entry) => entry.status === "success").length;
  const failedCount = results.length - successCount;
  const summary = `SUMMARY total=${results.length} success=${successCount} failed=${failedCount}`;

  logLines.push(summary);
  await fs.promises.writeFile(OUTPUT_RESULTS, JSON.stringify(results, null, 2));
  await fs.promises.writeFile(OUTPUT_LOG, logLines.join("\n") + "\n");

  console.log(summary);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
