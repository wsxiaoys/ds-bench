import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import pLimit from "p-limit";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import LlamaCloud from "@llamaindex/llama-cloud";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const INPUT_DIR = path.resolve(__dirname, "..", "inputs");
const OUTPUT_DIR = path.resolve(__dirname, "..", "outputs");
const OUTPUT_LOG = path.resolve(__dirname, "..", "output.log");

const classifyRules = [
  {
    type: "invoice",
    description:
      "commercial invoice with an invoice number, line items, and a grand total",
  },
  {
    type: "contract",
    description:
      "legal agreement signed by two or more parties with an effective date and term",
  },
];

const invoiceSchema = z.object({
  invoice_number: z.string().min(1),
  vendor_name: z.string().min(1),
  total_amount: z.number(),
  line_items: z
    .array(
      z.object({
        description: z.string().min(1),
        quantity: z.number(),
        unit_price: z.number(),
        total: z.number(),
      })
    )
    .min(1),
});

const contractSchema = z.object({
  parties: z.array(z.string().min(1)).min(2),
  effective_date: z.string().min(1),
  term: z.string().min(1),
});

const toJsonSchema = (schema: z.ZodTypeAny, name: string) => {
  const jsonSchema = zodToJsonSchema(schema, { name });
  if (
    typeof jsonSchema === "object" &&
    jsonSchema !== null &&
    "definitions" in jsonSchema &&
    jsonSchema.definitions &&
    typeof jsonSchema.definitions === "object" &&
    name in jsonSchema.definitions
  ) {
    return (jsonSchema.definitions as Record<string, unknown>)[name];
  }
  return jsonSchema;
};

const sleep = (ms: number) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const ensureDir = async (dirPath: string) => {
  await fs.promises.mkdir(dirPath, { recursive: true });
};

const getExtractResult = (job: any) => {
  if (job?.result?.extract_result) {
    return job.result.extract_result;
  }
  if (job?.extract_result) {
    return job.extract_result;
  }
  if (job?.result && typeof job.result === "object") {
    return job.result;
  }
  return job;
};

const main = async () => {
  const runId = process.env.ZEALT_RUN_ID;
  if (!runId) {
    throw new Error("ZEALT_RUN_ID is not set");
  }

  await ensureDir(OUTPUT_DIR);

  const inputFiles = (await fs.promises.readdir(INPUT_DIR))
    .filter((file) => file.toLowerCase().endsWith(".pdf"))
    .sort();

  if (inputFiles.length === 0) {
    throw new Error("No PDF files found in inputs directory");
  }

  const client = new LlamaCloud();

  const uploads = await Promise.all(
    inputFiles.map(async (fileName) => {
      const filePath = path.join(INPUT_DIR, fileName);
      const basename = path.basename(fileName, path.extname(fileName));
      const externalFileId = `${runId}-${basename}`;
      const file = await client.files.create({
        file: fs.createReadStream(filePath),
        purpose: "extract",
        external_file_id: externalFileId,
      });
      return {
        fileName,
        fileId: file.id,
        externalFileId,
      };
    })
  );

  const fileIds = uploads.map((upload) => upload.fileId);
  const classifyResponse = await client.classifier.classify({
    file_ids: fileIds,
    rules: classifyRules,
    mode: "FAST",
  });

  const classifyByFileId = new Map<
    string,
    { category: string; confidence: number }
  >();
  for (const item of classifyResponse.items ?? []) {
    if (item?.file_id && item?.result?.type) {
      classifyByFileId.set(item.file_id, {
        category: item.result.type,
        confidence: item.result.confidence,
      });
    }
  }

  const limit = pLimit(2);

  const extractResults = await Promise.all(
    uploads.map((upload) =>
      limit(async () => {
        const classifyResult = classifyByFileId.get(upload.fileId);
        if (!classifyResult) {
          throw new Error(`Missing classification for ${upload.fileName}`);
        }

        const schema =
          classifyResult.category === "invoice"
            ? invoiceSchema
            : contractSchema;
        const schemaName =
          classifyResult.category === "invoice" ? "Invoice" : "Contract";

        const extractJob = await client.extract.create({
          file_input: upload.fileId,
          configuration: {
            data_schema: toJsonSchema(schema, schemaName),
            extraction_target: "per_doc",
            tier: "agentic",
          },
        });

        let jobStatus = extractJob.status;
        let jobResponse = extractJob;

        while (jobStatus === "PENDING" || jobStatus === "RUNNING") {
          await sleep(1500);
          jobResponse = await client.extract.get(extractJob.id);
          jobStatus = jobResponse.status;
        }

        if (jobStatus !== "COMPLETED") {
          throw new Error(
            `Extract job ${extractJob.id} failed with status ${jobStatus}`
          );
        }

        const data = getExtractResult(jobResponse);

        return {
          fileName: upload.fileName,
          fileId: upload.fileId,
          category: classifyResult.category,
          confidence: classifyResult.confidence,
          data,
        };
      })
    )
  );

  const results: Record<
    string,
    { category: string; confidence: number; file_id: string; data: unknown }
  > = {};

  for (const result of extractResults) {
    results[result.fileName] = {
      category: result.category,
      confidence: result.confidence,
      file_id: result.fileId,
      data: result.data,
    };
  }

  await fs.promises.writeFile(
    path.join(OUTPUT_DIR, "results.json"),
    JSON.stringify(results, null, 2)
  );

  const logLines = extractResults.map((result) => {
    const fieldCount =
      result.data && typeof result.data === "object"
        ? Object.keys(result.data as Record<string, unknown>).length
        : 0;
    return `Routed: ${result.fileName} | category: ${result.category} | confidence: ${result.confidence} | fields: ${fieldCount}`;
  });

  await fs.promises.writeFile(OUTPUT_LOG, logLines.join("\n") + "\n");
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
