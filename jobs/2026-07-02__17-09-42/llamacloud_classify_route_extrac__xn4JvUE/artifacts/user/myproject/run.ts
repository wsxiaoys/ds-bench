/**
 * Classify → Route → Per-Category Extract
 * ----------------------------------------
 * 1. Upload every PDF under ./inputs to LlamaCloud, tagging each with an
 *    external_file_id = `<run-id>-<basename_without_ext>`.
 * 2. Run a *single* Classify job over the four file_ids with two rules
 *    (`invoice`, `contract`) and mode='FAST'.
 * 3. Per file, pick the Extract schema dictated by its category and run
 *    Extract concurrently (concurrency cap = 2) with
 *    `extraction_target: 'per_doc'` and `tier: 'agentic'`.
 * 4. Write outputs/results.json and output.log.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { createReadStream } from "node:fs";
import path from "node:path";

import LlamaCloud from "@llamaindex/llama-cloud";
import { z } from "zod";
import pLimit from "p-limit";

// ---------------------------------------------------------------------------
// Config & constants
// ---------------------------------------------------------------------------

const PROJECT_DIR = "/home/user/myproject";
const INPUTS_DIR = path.join(PROJECT_DIR, "inputs");
const OUTPUTS_DIR = path.join(PROJECT_DIR, "outputs");
const RUN_ID_FILE = "/logs/artifacts/run-id";

const EXTRACT_CONCURRENCY = 2;

const RUN_ID = readFileSync(RUN_ID_FILE, "utf8").trim();
console.log(`[init] run-id = ${RUN_ID}`);

if (!existsSync(OUTPUTS_DIR)) {
  mkdirSync(OUTPUTS_DIR, { recursive: true });
}

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const LineItemSchema = z.object({
  description: z.string(),
  quantity: z.number(),
  unit_price: z.number(),
  total: z.number(),
});

const InvoiceSchema = z.object({
  invoice_number: z.string(),
  vendor_name: z.string(),
  total_amount: z.number(),
  line_items: z.array(LineItemSchema),
});

const ContractSchema = z.object({
  parties: z.array(z.string()).min(2),
  effective_date: z.string(),
  term: z.string(),
});

const InvoiceJsonSchema = z.toJSONSchema(InvoiceSchema);
const ContractJsonSchema = z.toJSONSchema(ContractSchema);

console.log("[init] invoice schema:", JSON.stringify(InvoiceJsonSchema));
console.log("[init] contract schema:", JSON.stringify(ContractJsonSchema));

// ---------------------------------------------------------------------------
// Discover inputs
// ---------------------------------------------------------------------------

const INPUT_BASENAMES = [
  "acme_invoice.pdf",
  "globex_invoice.pdf",
  "services_contract.pdf",
  "nda_contract.pdf",
];

type InputRecord = {
  basename: string; // e.g. "acme_invoice.pdf"
  basenameNoExt: string; // e.g. "acme_invoice"
  absolutePath: string;
  externalFileId: string; // e.g. "zr55zqtdi2-acme_invoice"
};

const inputs: InputRecord[] = INPUT_BASENAMES.map((basename) => {
  const basenameNoExt = basename.replace(/\.pdf$/i, "");
  return {
    basename,
    basenameNoExt,
    absolutePath: path.join(INPUTS_DIR, basename),
    externalFileId: `${RUN_ID}-${basenameNoExt}`,
  };
});

// ---------------------------------------------------------------------------
// LlamaCloud client
// ---------------------------------------------------------------------------

const client = new LlamaCloud(); // picks up LLAMA_CLOUD_API_KEY from env

// ---------------------------------------------------------------------------
// Phase 1a — Upload all PDFs (concurrently)
// ---------------------------------------------------------------------------

type UploadedFile = { record: InputRecord; fileId: string };

async function uploadOne(rec: InputRecord): Promise<UploadedFile> {
  console.log(`[upload] ${rec.basename} (external_file_id=${rec.externalFileId})`);
  const stream = createReadStream(rec.absolutePath);
  const res = await client.files.create({
    // fs.createReadStream returns a ReadStream which matches the SDK's
    // Uploadable (FsReadStream) type at runtime.
    file: stream as unknown as Parameters<typeof client.files.create>[0]["file"],
    purpose: "extract",
    external_file_id: rec.externalFileId,
  });
  console.log(`[upload]   -> file id ${res.id}`);
  return { record: rec, fileId: res.id };
}

const uploaded: UploadedFile[] = await Promise.all(inputs.map(uploadOne));
const fileIdByBasename = new Map(uploaded.map((u) => [u.record.basename, u.fileId]));

// ---------------------------------------------------------------------------
// Phase 1b — Run a single Classify job over all four file_ids
// ---------------------------------------------------------------------------

const allFileIds = uploaded.map((u) => u.fileId);

const classifyRules = [
  {
    type: "invoice",
    description:
      "Commercial invoice issued by a vendor to a buyer. Must include an invoice number, one or more billed line items, and a grand total amount.",
  },
  {
    type: "contract",
    description:
      "Legal agreement signed by two or more parties that includes an effective date and a term (duration).",
  },
];

console.log(
  `[classify] starting single classify job over ${allFileIds.length} files`
);

const classifyResponse = await client.classifier.classify({
  file_ids: allFileIds,
  rules: classifyRules,
  mode: "FAST",
});

const classifyByFileId = new Map<
  string,
  { type: string; confidence: number; reasoning?: string }
>();
for (const item of classifyResponse.items) {
  if (!item.file_id) continue;
  if (!item.result || !item.result.type) {
    throw new Error(
      `[classify] missing result for file_id=${item.file_id}: ${JSON.stringify(item)}`
    );
  }
  classifyByFileId.set(item.file_id, {
    type: item.result.type,
    confidence: item.result.confidence,
    reasoning: item.result.reasoning,
  });
}

// Make sure every uploaded file got a classification back.
for (const u of uploaded) {
  if (!classifyByFileId.has(u.fileId)) {
    throw new Error(`[classify] no classification returned for ${u.fileId}`);
  }
}

// Sanity: both files per category must end up with the same type.
const typeCounts: Record<string, number> = {};
for (const c of classifyByFileId.values()) {
  typeCounts[c.type] = (typeCounts[c.type] ?? 0) + 1;
}
console.log("[classify] type counts:", typeCounts);

// ---------------------------------------------------------------------------
// Phase 2 — Per-category Extract, concurrently with cap = 2
// ---------------------------------------------------------------------------

const limit = pLimit(EXTRACT_CONCURRENCY);

type ExtractionOutcome = {
  record: InputRecord;
  fileId: string;
  category: string;
  confidence: number;
  data: Record<string, unknown>;
};

async function extractOne(u: UploadedFile): Promise<ExtractionOutcome> {
  const cls = classifyByFileId.get(u.fileId);
  if (!cls) throw new Error(`[extract] no classification for ${u.fileId}`);

  const category = cls.type;
  const isInvoice = category === "invoice";
  const schema = isInvoice ? InvoiceJsonSchema : ContractJsonSchema;

  console.log(
    `[extract] ${u.record.basename} -> category=${category} confidence=${cls.confidence}`
  );

  return limit(async () => {
    const job = await client.extract.create({
      file_input: u.fileId,
      configuration: {
        data_schema: schema as Record<
          string,
          | { [key: string]: unknown }
          | unknown[]
          | string
          | number
          | boolean
          | null
        >,
        extraction_target: "per_doc",
        tier: "agentic",
      },
    });

    let current = job;
    const startedAt = Date.now();
    while (
      current.status === "PENDING" ||
      current.status === "RUNNING" ||
      current.status === "THROTTLED"
    ) {
      if (Date.now() - startedAt > 10 * 60 * 1000) {
        throw new Error(`[extract] timeout for ${u.record.basename}`);
      }
      await new Promise((r) => setTimeout(r, 2000));
      current = await client.extract.get(current.id);
    }

    if (current.status !== "COMPLETED") {
      throw new Error(
        `[extract] ${u.record.basename} ended with status=${current.status} error=${current.error_message}`
      );
    }

    const data = (current.extract_result ?? {}) as Record<string, unknown>;
    return {
      record: u.record,
      fileId: u.fileId,
      category,
      confidence: cls.confidence,
      data,
    };
  });
}

const outcomes = await Promise.all(uploaded.map(extractOne));

// ---------------------------------------------------------------------------
// Phase 3 — Aggregate artifacts
// ---------------------------------------------------------------------------

const results: Record<
  string,
  {
    category: string;
    confidence: number;
    file_id: string;
    data: Record<string, unknown>;
  }
> = {};

for (const o of outcomes) {
  results[o.record.basename] = {
    category: o.category,
    confidence: o.confidence,
    file_id: o.fileId,
    data: o.data,
  };
}

writeFileSync(
  path.join(OUTPUTS_DIR, "results.json"),
  JSON.stringify(results, null, 2)
);

const logLines = outcomes.map((o) => {
  const topLevelCount = Object.keys(o.data ?? {}).length;
  return `Routed: ${o.record.basename} | category: ${o.category} | confidence: ${o.confidence} | fields: ${topLevelCount}`;
});
writeFileSync(path.join(PROJECT_DIR, "output.log"), logLines.join("\n") + "\n");

console.log("[done] wrote outputs/results.json and output.log");