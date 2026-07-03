import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { z } from 'zod';
import pLimit from 'p-limit';

// The LlamaCloud SDK is CommonJS, so load it via createRequire.
const require = createRequire(import.meta.url);
const { LlamaCloud } = require('@llamaindex/llama-cloud') as typeof import('@llamaindex/llama-cloud');

// ---------- Zod schema for Invoice ----------
const InvoiceSchema = z.object({
  vendor_name: z.string(),
  invoice_number: z.string(),
  total_amount: z.number(),
  currency: z.string().length(3),
});

const dataSchema = z.toJSONSchema(InvoiceSchema, { target: 'draft-7' });

// ---------- Discover PDFs (case-insensitive) ----------
const INVOICES_DIR = '/home/user/myproject/invoices';
const RESULTS_PATH = '/home/user/myproject/results.json';
const LOG_PATH = '/home/user/myproject/output.log';

function discoverPdfs(dir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const out: string[] = [];
  for (const e of entries) {
    if (!e.isFile()) continue;
    if (e.name.toLowerCase().endsWith('.pdf')) {
      out.push(path.join(dir, e.name));
    }
  }
  out.sort();
  return out;
}

// ---------- Per-job polling with client-side timeout ----------
const PER_JOB_TIMEOUT_MS = 240 * 1000;
const TERMINAL = new Set(['COMPLETED', 'FAILED', 'CANCELLED']);

interface ResultEntry {
  file: string;
  status: 'success' | 'error';
  data?: Record<string, unknown>;
  error?: string;
}

function sleep(ms: number): Promise<void> {
  return new Promise((res) => setTimeout(res, ms));
}

async function pollUntilTerminal(
  client: InstanceType<typeof LlamaCloud>,
  jobId: string,
  timeoutMs: number,
): Promise<{ job: any; timedOut: boolean }> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const job: any = await client.extract.get(jobId);
    if (TERMINAL.has(job.status)) {
      return { job, timedOut: false };
    }
    await sleep(2000);
  }
  // Timed out: do one final get for completeness, but treat as failure.
  let last: any = null;
  try {
    last = await client.extract.get(jobId);
  } catch {
    // ignore
  }
  return { job: last, timedOut: true };
}

// ---------- Process a single file end-to-end ----------
async function processFile(
  client: InstanceType<typeof LlamaCloud>,
  filePath: string,
): Promise<ResultEntry> {
  const base = path.basename(filePath);
  try {
    // 1. Upload
    const uploaded: any = await client.files.create({
      file: fs.createReadStream(filePath),
      purpose: 'extract',
    });
    const fileId: string = uploaded.id;

    // 2. Create extract job
    const job: any = await client.extract.create({
      file_input: fileId,
      configuration: {
        data_schema: dataSchema as any,
        extraction_target: 'per_doc',
        tier: 'cost_effective',
      },
    });

    // 3. Poll with per-job timeout
    const { job: finalJob, timedOut } = await pollUntilTerminal(
      client,
      job.id,
      PER_JOB_TIMEOUT_MS,
    );

    if (timedOut) {
      return {
        file: base,
        status: 'error',
        error: `Job ${job.id} did not reach terminal status within ${PER_JOB_TIMEOUT_MS / 1000}s`,
      };
    }

    if (finalJob.status === 'COMPLETED') {
      const data = finalJob.extract_result ?? {};
      return {
        file: base,
        status: 'success',
        data: data as Record<string, unknown>,
      };
    }

    if (finalJob.status === 'FAILED') {
      return {
        file: base,
        status: 'error',
        error: finalJob.error_message ?? `Job ${job.id} failed`,
      };
    }

    // CANCELLED or other terminal
    return {
      file: base,
      status: 'error',
      error: `Job ${job.id} ended with status ${finalJob.status}`,
    };
  } catch (err: any) {
    return {
      file: base,
      status: 'error',
      error: err?.message ?? String(err),
    };
  }
}

// ---------- Main ----------
async function main(): Promise<void> {
  if (!process.env.LLAMA_CLOUD_API_KEY) {
    throw new Error('LLAMA_CLOUD_API_KEY is not set');
  }

  const client = new LlamaCloud({ apiKey: process.env.LLAMA_CLOUD_API_KEY });

  const pdfs = discoverPdfs(INVOICES_DIR);
  const logLines: string[] = [];

  const limit = pLimit(3);
  const tasks = pdfs.map((p) =>
    limit(async () => {
      console.log(`Starting ${path.basename(p)}`);
      const r = await processFile(client, p);
      const line = `PROCESSED ${r.file}: ${r.status}`;
      logLines.push(line);
      console.log(line);
      return r;
    }),
  );

  const results = await Promise.all(tasks);

  // Persist results.json
  fs.writeFileSync(RESULTS_PATH, JSON.stringify(results, null, 2));

  // Summary
  const total = results.length;
  const success = results.filter((r) => r.status === 'success').length;
  const failed = total - success;
  const summary = `SUMMARY total=${total} success=${success} failed=${failed}`;

  logLines.push(summary);
  fs.writeFileSync(LOG_PATH, logLines.join('\n') + '\n');
  console.log(summary);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
