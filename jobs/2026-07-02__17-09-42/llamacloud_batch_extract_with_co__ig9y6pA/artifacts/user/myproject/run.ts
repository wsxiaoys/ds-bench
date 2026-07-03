/**
 * Batch Invoice Extraction with Bounded Concurrency (LlamaCloud Extract v2)
 *
 * Discovers every *.pdf file under /home/user/myproject/invoices/, uploads
 * each to LlamaCloud, and runs schema-driven extractions concurrently in a
 * worker pool of 3. Each job is polled with a 240s client-side timeout.
 * Results are written to /home/user/myproject/results.json and a human-
 * readable log to /home/user/myproject/output.log.
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { z } from "zod/v4";
import LlamaCloud from "@llamaindex/llama-cloud";
import pLimit from "p-limit";

// -------- Configuration ------------------------------------------------------

const INVOICES_DIR = "/home/user/myproject/invoices";
const RESULTS_PATH = "/home/user/myproject/results.json";
const LOG_PATH = "/home/user/myproject/output.log";
const CONCURRENCY = 3;
const PER_JOB_TIMEOUT_MS = 240_000;
const POLL_INTERVAL_MS = 2_000;

const TERMINAL_STATUSES = new Set(["COMPLETED", "FAILED", "CANCELLED"]);

// -------- Schema -------------------------------------------------------------

/**
 * Invoice extraction schema. Converted to a JSON Schema via `z.toJSONSchema`
 * and passed inline to LlamaCloud Extract.
 */
const Invoice = z.object({
  vendor_name: z.string().describe(
    "The legal name of the company that issued the invoice (the seller/vendor).",
  ),
  invoice_number: z.string().describe(
    "The invoice identifier printed on the document (e.g. 'INV-12345').",
  ),
  total_amount: z.number().describe(
    "The grand total amount due on the invoice, as a number (no currency symbol).",
  ),
  currency: z
    .string()
    .length(3)
    .describe(
      "The 3-letter ISO 4217 currency code (e.g. 'USD', 'EUR', 'GBP').",
    ),
});

type InvoiceData = z.infer<typeof Invoice>;

// -------- Result types ------------------------------------------------------

type ResultEntry =
  | { file: string; status: "success"; data: InvoiceData; error?: undefined }
  | { file: string; status: "error"; data?: undefined; error: string };

// -------- Helpers -----------------------------------------------------------

function discoverPdfs(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  return entries
    .filter((e) => e.isFile() && e.name.toLowerCase().endsWith(".pdf"))
    .map((e) => e.name)
    .sort();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function describeError(err: unknown): string {
  if (err instanceof Error) {
    const code = (err as Error & { code?: string }).code;
    return code ? `${err.name}: ${err.message} (code=${code})` : `${err.name}: ${err.message}`;
  }
  return String(err);
}

/** Build a clean JSON Schema payload from zod, preserving only what we need. */
function invoiceJsonSchema(): Record<string, unknown> {
  const raw = z.toJSONSchema(Invoice) as Record<string, unknown>;
  // `z.toJSONSchema` adds a few metadata fields. The extractor only really
  // needs `type`, `properties`, and `required`; strip the rest so we send a
  // minimal, predictable payload.
  const properties = (raw["properties"] ?? {}) as Record<string, unknown>;
  const required = Array.isArray(raw["required"]) ? raw["required"] : [];
  return { type: "object", properties, required };
}

// -------- Per-file worker ---------------------------------------------------

async function processFile(
  client: LlamaCloud,
  fileName: string,
  dataSchema: Record<string, unknown>,
): Promise<ResultEntry> {
  const fullPath = path.join(INVOICES_DIR, fileName);
  try {
    // 1. Upload the PDF to LlamaCloud.
    const uploaded = await client.files.create({
      file: fs.createReadStream(fullPath),
      purpose: "extract",
    });
    const fileId = uploaded.id;
    if (!fileId) {
      return {
        file: fileName,
        status: "error",
        error: "File upload did not return an id",
      };
    }

    // 2. Create a schema-driven extraction job (cost-effective, per-doc).
    const job = await client.extract.create({
      file_input: fileId,
      configuration: {
        data_schema: dataSchema,
        extraction_target: "per_doc",
        tier: "cost_effective",
      },
    });

    // 3. Poll until terminal status, with a 240s client-side timeout.
    const start = Date.now();
    let current = job;
    while (!TERMINAL_STATUSES.has(current.status)) {
      if (Date.now() - start >= PER_JOB_TIMEOUT_MS) {
        return {
          file: fileName,
          status: "error",
          error: `Polling timeout after ${PER_JOB_TIMEOUT_MS}ms (last_status=${current.status})`,
        };
      }
      await sleep(POLL_INTERVAL_MS);
      current = await client.extract.get(current.id);
    }

    if (current.status === "COMPLETED") {
      const data = current.extract_result;
      if (data == null) {
        return {
          file: fileName,
          status: "error",
          error: "Job completed but extract_result was null",
        };
      }
      if (Array.isArray(data)) {
        // For per_doc we expect an object, not an array. If we get an array,
        // surface it as an error rather than silently reshaping it.
        return {
          file: fileName,
          status: "error",
          error: `Expected object extract_result for per_doc, got array`,
        };
      }
      // Validate against our Zod schema to ensure shape contracts.
      const parsed = Invoice.safeParse(data);
      if (!parsed.success) {
        return {
          file: fileName,
          status: "error",
          error: `extract_result failed schema validation: ${parsed.error.message}`,
        };
      }
      return { file: fileName, status: "success", data: parsed.data };
    }

    const errMsg =
      current.error_message ?? `Job ended with status=${current.status}`;
    return { file: fileName, status: "error", error: errMsg };
  } catch (err) {
    return { file: fileName, status: "error", error: describeError(err) };
  }
}

// -------- Main ---------------------------------------------------------------

async function main(): Promise<void> {
  const apiKey = process.env.LLAMA_CLOUD_API_KEY;
  if (!apiKey) {
    console.error("LLAMA_CLOUD_API_KEY environment variable is not set");
    process.exit(1);
  }

  const client = new LlamaCloud({ apiKey });
  const pdfs = discoverPdfs(INVOICES_DIR);
  if (pdfs.length === 0) {
    fs.writeFileSync(RESULTS_PATH, "[]");
    fs.writeFileSync(LOG_PATH, "");
    console.log("No PDF files found, nothing to do.");
    return;
  }

  console.log(
    `Found ${pdfs.length} PDF file(s) in ${INVOICES_DIR}; processing with concurrency=${CONCURRENCY}, per-job timeout=${PER_JOB_TIMEOUT_MS}ms.`,
  );

  const dataSchema = invoiceJsonSchema();

  // Run all files through a p-limit pool of size 3.
  const limit = pLimit(CONCURRENCY);
  const tasks = pdfs.map((name) =>
    limit(() => processFile(client, name, dataSchema)),
  );
  const settled = await Promise.all(tasks);

  // Build the log lines (one PROCESSED line per file, in deterministic order).
  const logLines: string[] = pdfs.map((name) => {
    const r = settled.find((s) => s.file === name)!;
    return `PROCESSED ${name}: ${r.status === "success" ? "success" : "error"}`;
  });

  // Persist the structured results.
  fs.writeFileSync(RESULTS_PATH, JSON.stringify(settled, null, 2));

  // Compute and emit the summary.
  const total = settled.length;
  const success = settled.filter((r) => r.status === "success").length;
  const failed = total - success;
  const summary = `SUMMARY total=${total} success=${success} failed=${failed}`;
  logLines.push(summary);

  fs.writeFileSync(LOG_PATH, logLines.join("\n") + "\n");

  console.log(summary);
  console.log(`Wrote ${total} results to ${RESULTS_PATH}`);
  console.log(`Wrote log to ${LOG_PATH}`);
}

main().catch((err) => {
  console.error("Fatal error:", describeError(err));
  process.exit(1);
});
