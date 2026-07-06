import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import LlamaCloud from "@llamaindex/llama-cloud";
import { z } from "zod";
import pLimit from "p-limit";

const PROJECT_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

const INPUTS_DIR = path.join(PROJECT_ROOT, "inputs");
const OUTPUTS_DIR = path.join(PROJECT_ROOT, "outputs");
const RESULTS_PATH = path.join(OUTPUTS_DIR, "results.json");
const LOG_PATH = path.join(PROJECT_ROOT, "output.log");
const RUN_ID_PATH = "/logs/artifacts/run-id";

// ---------------------------------------------------------------------------
// Schemas (Zod -> JSON Schema)
// ---------------------------------------------------------------------------

const invoiceSchema = z.object({
  invoice_number: z.string().describe("The invoice number"),
  vendor_name: z.string().describe("The name of the vendor / supplier"),
  total_amount: z.number().describe("The grand total of the invoice"),
  line_items: z
    .array(
      z.object({
        description: z.string(),
        quantity: z.number(),
        unit_price: z.number(),
        total: z.number(),
      }),
    )
    .describe("Line items on the invoice"),
});

const contractSchema = z.object({
  parties: z
    .array(z.string())
    .min(2)
    .describe("The two or more parties signing the agreement"),
  effective_date: z
    .string()
    .describe("Effective date of the agreement in ISO YYYY-MM-DD if possible"),
  term: z.string().describe('Term of the agreement, e.g. "12 months"'),
});

const SCHEMAS: Record<string, z.ZodType> = {
  invoice: invoiceSchema,
  contract: contractSchema,
};

const CATEGORY_RULES = [
  {
    type: "invoice",
    description:
      "A commercial invoice that contains an invoice number, line items, and a grand total.",
  },
  {
    type: "contract",
    description:
      "A legal agreement signed by two or more parties that includes an effective date and a term.",
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function readRunId(): string {
  const raw = fs.readFileSync(RUN_ID_PATH, "utf8").trim();
  if (!raw) throw new Error(`run-id file at ${RUN_ID_PATH} is empty`);
  return raw;
}

function basenameNoExt(filePath: string): string {
  return path.basename(filePath, path.extname(filePath));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface UploadedFile {
  path: string; // absolute path on disk
  basename: string; // e.g. "acme_invoice.pdf"
  fileId: string;
  externalFileId: string;
}

// ---------------------------------------------------------------------------
// Phase 1: Upload + Classify
// ---------------------------------------------------------------------------

async function findFileByExternalId(
  client: LlamaCloud,
  externalFileId: string,
): Promise<string | null> {
  // Reuse an existing upload if one with this external_file_id is already
  // present (the API enforces a unique constraint on external_file_id, so a
  // naive re-upload would 400). List is paginated; a single page is enough
  // because external_file_id is unique within a project.
  for await (const f of client.files.list({ external_file_id: externalFileId })) {
    return f.id;
  }
  return null;
}

async function uploadFiles(
  client: LlamaCloud,
  runId: string,
  files: string[],
): Promise<UploadedFile[]> {
  const uploaded: UploadedFile[] = [];
  for (const filePath of files) {
    const basename = path.basename(filePath);
    const externalFileId = `${runId}-${basenameNoExt(filePath)}`;
    const existingId = await findFileByExternalId(client, externalFileId);
    if (existingId) {
      process.stdout.write(
        `Reusing existing upload for ${basename} (external_file_id=${externalFileId}) -> file_id=${existingId}\n`,
      );
      uploaded.push({
        path: filePath,
        basename,
        fileId: existingId,
        externalFileId,
      });
      continue;
    }
    process.stdout.write(
      `Uploading ${basename} (external_file_id=${externalFileId})...\n`,
    );
    const res = await client.files.create({
      file: fs.createReadStream(filePath),
      purpose: "classify",
      external_file_id: externalFileId,
    });
    uploaded.push({
      path: filePath,
      basename,
      fileId: res.id,
      externalFileId,
    });
    process.stdout.write(`  -> file_id=${res.id}\n`);
  }
  return uploaded;
}

interface Classification {
  type: string | null;
  confidence: number;
}

async function classifyFiles(
  client: LlamaCloud,
  fileIds: string[],
): Promise<Map<string, Classification>> {
  process.stdout.write(
    `\nClassifying ${fileIds.length} files (mode=FAST)...\n`,
  );
  const result = await client.classifier.classify({
    file_ids: fileIds,
    rules: CATEGORY_RULES,
    mode: "FAST",
  });

  const byFileId = new Map<string, Classification>();
  for (const item of result.items) {
    const fid = item.file_id;
    if (!fid) continue;
    const type = item.result?.type ?? null;
    const confidence =
      typeof item.result?.confidence === "number"
        ? item.result.confidence
        : 0;
    byFileId.set(fid, { type, confidence });
    process.stdout.write(
      `  classify file_id=${fid} -> type=${type} confidence=${confidence}\n`,
    );
  }

  // Validate: every file must have a type, and both files in each category must
  // share the same type.
  for (const fid of fileIds) {
    const c = byFileId.get(fid);
    if (!c || !c.type) {
      throw new Error(`File ${fid} was not classified with a valid type`);
    }
  }
  return byFileId;
}

// ---------------------------------------------------------------------------
// Phase 2: Per-category Extract (concurrent, cap 2)
// ---------------------------------------------------------------------------

async function pollExtract(
  client: LlamaCloud,
  jobId: string,
): Promise<Record<string, unknown>> {
  // Poll client.extract.get(jobId) until a terminal status is reached.
  const terminal = new Set(["COMPLETED", "FAILED", "CANCELLED"]);
  let attempts = 0;
  // Allow up to ~10 minutes of polling.
  const maxAttempts = 200;
  while (true) {
    const job = await client.extract.get(jobId);
    attempts += 1;
    if (terminal.has(job.status)) {
      if (job.status !== "COMPLETED") {
        throw new Error(
          `Extract job ${jobId} ended with status ${job.status}: ${job.error_message ?? "no error message"}`,
        );
      }
      const er = job.extract_result;
      if (er == null) {
        throw new Error(`Extract job ${jobId} completed but extract_result is null`);
      }
      // For per_doc, extract_result is a single object.
      if (Array.isArray(er)) {
        return (er[0] as Record<string, unknown>) ?? {};
      }
      return er as Record<string, unknown>;
    }
    if (attempts >= maxAttempts) {
      throw new Error(`Extract job ${jobId} timed out waiting for completion`);
    }
    await sleep(3000);
  }
}

async function extractOne(
  client: LlamaCloud,
  file: UploadedFile,
  category: string,
): Promise<Record<string, unknown>> {
  const schema = SCHEMAS[category];
  if (!schema) throw new Error(`No schema defined for category "${category}"`);
  const dataSchema = z.toJSONSchema(schema, "draft-2020-12");

  process.stdout.write(
    `Extracting ${file.basename} as ${category} (per_doc, agentic)...\n`,
  );
  const job = await client.extract.create({
    file_input: file.fileId,
    configuration: {
      data_schema: dataSchema as unknown as Record<string, unknown>,
      extraction_target: "per_doc",
      tier: "agentic",
    },
  });
  const data = await pollExtract(client, job.id);
  process.stdout.write(
    `  -> ${file.basename} extracted fields: ${Object.keys(data).length}\n`,
  );
  return data;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const runId = readRunId();
  process.stdout.write(`Run id: ${runId}\n`);

  if (!process.env.LLAMA_CLOUD_API_KEY) {
    throw new Error("LLAMA_CLOUD_API_KEY environment variable is not set");
  }
  const client = new LlamaCloud();

  // Gather input PDFs (do NOT hard-code routing by filename).
  const files = fs
    .readdirSync(INPUTS_DIR)
    .filter((f) => f.toLowerCase().endsWith(".pdf"))
    .map((f) => path.join(INPUTS_DIR, f))
    .sort();

  if (files.length === 0) {
    throw new Error(`No PDF files found in ${INPUTS_DIR}`);
  }

  // Phase 1: upload + classify
  const uploaded = await uploadFiles(client, runId, files);
  const fileIds = uploaded.map((u) => u.fileId);
  const classifications = await classifyFiles(client, fileIds);

  // Phase 2: per-category extract, concurrent with cap of 2.
  const limit = pLimit(2);
  const results: Record<
    string,
    {
      category: string;
      confidence: number;
      file_id: string;
      data: Record<string, unknown>;
    }
  > = {};

  const extractTasks = uploaded.map((file) =>
    limit(async () => {
      const cls = classifications.get(file.fileId);
      if (!cls || !cls.type) {
        throw new Error(`No classification for ${file.basename}`);
      }
      const category = cls.type;
      const data = await extractOne(client, file, category);
      results[file.basename] = {
        category,
        confidence: cls.confidence,
        file_id: file.fileId,
        data,
      };
    }),
  );
  await Promise.all(extractTasks);

  // Aggregate artifacts.
  fs.mkdirSync(OUTPUTS_DIR, { recursive: true });
  fs.writeFileSync(RESULTS_PATH, JSON.stringify(results, null, 2) + "\n");

  const logLines = Object.entries(results).map(([basename, entry]) => {
    const fieldCount = Object.keys(entry.data).length;
    return `Routed: ${basename} | category: ${entry.category} | confidence: ${entry.confidence} | fields: ${fieldCount}`;
  });
  fs.writeFileSync(LOG_PATH, logLines.join("\n") + "\n");

  process.stdout.write(`\nWrote ${RESULTS_PATH}\n`);
  process.stdout.write(`Wrote ${LOG_PATH}\n`);
  for (const line of logLines) process.stdout.write(line + "\n");
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error("FATAL:", err);
    process.exit(1);
  });