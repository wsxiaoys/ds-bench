import fs from 'fs';
import path from 'path';
import { LlamaCloud, toFile } from '@llamaindex/llama-cloud';
import { z } from 'zod';
import pLimit from 'p-limit';

// ---------------------------------------------------------------------------
// Zod schema definition
// ---------------------------------------------------------------------------

const Invoice = z.object({
  vendor_name: z.string().describe('Name of the vendor or supplier'),
  invoice_number: z.string().describe('Unique invoice identifier'),
  total_amount: z.number().describe('Total amount due on the invoice'),
  currency: z
    .string()
    .describe('ISO 4217 three-letter currency code, e.g. USD'),
});

type InvoiceType = z.infer<typeof Invoice>;

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const INVOICES_DIR = '/home/user/myproject/invoices';
const RESULTS_PATH = '/home/user/myproject/results.json';
const LOG_PATH = '/home/user/myproject/output.log';
const MAX_CONCURRENCY = 3;
const JOB_TIMEOUT_MS = 240_000; // 240 seconds
const POLL_INTERVAL_MS = 3_000; // poll every 3 seconds

const TERMINAL_STATUSES = new Set(['COMPLETED', 'FAILED', 'CANCELLED']);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SuccessEntry = { file: string; status: 'success'; data: InvoiceType };
type ErrorEntry = { file: string; status: 'error'; error: string };
type ResultEntry = SuccessEntry | ErrorEntry;

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

const logLines: string[] = [];

function appendLog(line: string): void {
  logLines.push(line);
}

function discoverPdfs(dir: string): string[] {
  const entries = fs.readdirSync(dir);
  return entries
    .filter(e => e.toLowerCase().endsWith('.pdf'))
    .map(e => path.join(dir, e));
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Per-file processing
// ---------------------------------------------------------------------------

async function processFile(
  client: LlamaCloud,
  filePath: string,
  dataSchema: object,
): Promise<ResultEntry> {
  const fileName = path.basename(filePath);

  try {
    // 1. Upload file
    const fileStream = fs.createReadStream(filePath);
    const uploadable = await toFile(fileStream, fileName, {
      type: 'application/pdf',
    });

    const uploaded = await client.files.create({
      file: uploadable,
      purpose: 'extract',
    });

    const fileId = uploaded.id;

    // 2. Create extract job
    const job = await client.extract.create({
      file_input: fileId,
      configuration: {
        data_schema: dataSchema as Record<string, Record<string, unknown>>,
        extraction_target: 'per_doc',
        tier: 'cost_effective',
      },
    });

    const jobId = job.id;

    // 3. Poll until terminal status or client-side timeout
    const deadline = Date.now() + JOB_TIMEOUT_MS;
    let currentJob = job;

    while (!TERMINAL_STATUSES.has((currentJob.status ?? '').toUpperCase())) {
      if (Date.now() >= deadline) {
        throw new Error(
          `Job ${jobId} timed out after ${JOB_TIMEOUT_MS / 1000}s`,
        );
      }
      await sleep(POLL_INTERVAL_MS);
      currentJob = await client.extract.get(jobId);
    }

    const finalStatus = (currentJob.status ?? '').toUpperCase();

    if (finalStatus !== 'COMPLETED') {
      const errMsg = currentJob.error_message ?? `Job ended with status ${finalStatus}`;
      throw new Error(errMsg);
    }

    // 4. Parse extracted data
    const rawResult = currentJob.extract_result;
    // per_doc returns a single object; per_page / per_table_row returns an array
    const candidate = Array.isArray(rawResult) ? rawResult[0] : rawResult;

    let extractedData: InvoiceType;
    const parsed = Invoice.safeParse(candidate);

    if (parsed.success) {
      extractedData = parsed.data;
    } else {
      // Best-effort coercion for minor type mismatches (e.g. total_amount as string)
      const raw = candidate as Record<string, unknown> | null | undefined;
      extractedData = {
        vendor_name: String(raw?.vendor_name ?? ''),
        invoice_number: String(raw?.invoice_number ?? ''),
        total_amount: Number(raw?.total_amount ?? 0),
        currency: String(raw?.currency ?? 'USD')
          .toUpperCase()
          .slice(0, 3),
      };
    }

    appendLog(`PROCESSED ${fileName}: success`);
    return { file: fileName, status: 'success', data: extractedData };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    appendLog(`PROCESSED ${fileName}: error - ${message}`);
    return { file: fileName, status: 'error', error: message };
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const apiKey = process.env.LLAMA_CLOUD_API_KEY;
  if (!apiKey) {
    console.error('ERROR: LLAMA_CLOUD_API_KEY environment variable is not set');
    process.exit(1);
  }

  // Initialise LlamaCloud client
  const client = new LlamaCloud({ token: apiKey });

  // Build JSON Schema from Zod schema
  const dataSchema = z.toJSONSchema(Invoice);

  // Discover PDF files
  const pdfPaths = discoverPdfs(INVOICES_DIR);
  if (pdfPaths.length === 0) {
    console.error('No PDF files found under', INVOICES_DIR);
    process.exit(1);
  }

  console.log(`Discovered ${pdfPaths.length} PDF file(s): ${pdfPaths.map(p => path.basename(p)).join(', ')}`);

  // Bounded concurrency — at most MAX_CONCURRENCY jobs in-flight at once
  const limit = pLimit(MAX_CONCURRENCY);

  const tasks = pdfPaths.map(filePath =>
    limit(() => processFile(client, filePath, dataSchema)),
  );

  const results: ResultEntry[] = await Promise.all(tasks);

  // Persist results
  fs.writeFileSync(RESULTS_PATH, JSON.stringify(results, null, 2), 'utf-8');

  // Build summary
  const total = results.length;
  const success = results.filter(r => r.status === 'success').length;
  const failed = results.filter(r => r.status === 'error').length;
  const summaryLine = `SUMMARY total=${total} success=${success} failed=${failed}`;

  appendLog(summaryLine);

  // Write log file
  fs.writeFileSync(LOG_PATH, logLines.join('\n') + '\n', 'utf-8');

  // Print summary to stdout (required by acceptance criteria)
  console.log(summaryLine);
}

main().catch(err => {
  console.error('Fatal pipeline error:', err);
  process.exit(1);
});
