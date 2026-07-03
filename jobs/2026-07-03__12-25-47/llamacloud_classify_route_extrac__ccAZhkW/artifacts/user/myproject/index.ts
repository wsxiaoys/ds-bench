import LlamaCloud from '@llamaindex/llama-cloud';
import { z } from 'zod';

import pLimit from 'p-limit';
import fs from 'node:fs';
import path from 'node:path';

// ---------- Schemas ----------
const lineItemSchema = z.object({
  description: z.string(),
  quantity: z.number(),
  unit_price: z.number(),
  total: z.number(),
});

const invoiceSchema = z.object({
  invoice_number: z.string(),
  vendor_name: z.string(),
  total_amount: z.number(),
  line_items: z.array(lineItemSchema),
});

const contractSchema = z.object({
  parties: z.array(z.string()).min(2),
  effective_date: z.string(),
  term: z.string(),
});

// ---------- Helpers ----------
function readRunId(): string {
  return fs.readFileSync('/logs/artifacts/run-id', 'utf8').trim();
}

function stripMeta<T extends Record<string, any>>(obj: T): T {
  // zodToJsonSchema can include $schema; strip any keys starting with $ (LLM extractors don't need them).
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (k.startsWith('$')) continue;
    out[k] = v;
  }
  return out as T;
}

async function pollUntilDone<T extends { status: string }>(
  get: () => Promise<T>,
  isDone: (r: T) => boolean,
  { intervalMs = 2000, timeoutMs = 10 * 60 * 1000 } = {},
): Promise<T> {
  const start = Date.now();
  while (true) {
    const r = await get();
    if (isDone(r)) return r;
    if (['FAILED', 'CANCELLED'].includes(r.status)) {
      throw new Error(`Job ended with status ${r.status}`);
    }
    if (Date.now() - start > timeoutMs) {
      throw new Error('Timed out waiting for job');
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}

// ---------- Main ----------
async function main() {
  const runId = readRunId();
  console.log(`[run] run-id=${runId}`);

  const inputsDir = path.resolve('./inputs');
  const outputsDir = path.resolve('./outputs');
  fs.mkdirSync(outputsDir, { recursive: true });

  const basenames = fs
    .readdirSync(inputsDir)
    .filter((f) => f.toLowerCase().endsWith('.pdf'))
    .sort();

  const client = new LlamaCloud();

  // ---- Phase 0: Upload files ----
  type Uploaded = { basename: string; fileId: string };
  const uploaded: Uploaded[] = [];
  for (const basename of basenames) {
    const fullPath = path.join(inputsDir, basename);
    const stem = basename.replace(/\.[^.]+$/, '');
    const externalFileId = `${runId}-${stem}`;
    console.log(`[upload] ${basename} (external_file_id=${externalFileId})`);
    const file = await client.files.create({
      file: fs.createReadStream(fullPath),
      purpose: 'extract',
      external_file_id: externalFileId,
    });
    uploaded.push({ basename, fileId: file.id });
    console.log(`[upload] -> ${file.id}`);
  }

  // ---- Phase 1: Classify ----
  const fileIds = uploaded.map((u) => u.fileId);
  console.log(`[classify] starting for ${fileIds.length} files`);
  const classifyResult = await client.classifier.classify({
    file_ids: fileIds,
    rules: [
      {
        type: 'invoice',
        description:
          'A commercial invoice issued by a vendor to a buyer. It must include an invoice number, line items (description, quantity, unit price, total), and a grand total amount.',
      },
      {
        type: 'contract',
        description:
          'A legal agreement signed by two or more parties. It must identify the parties and include an effective date and a term/duration (e.g., "12 months").',
      },
    ],
    mode: 'FAST',
  });

  // Index results by file_id (order is NOT guaranteed)
  const classifyByFileId = new Map<string, { type: string; confidence: number }>();
  for (const item of classifyResult.items) {
    if (!item.file_id || !item.result) continue;
    classifyByFileId.set(item.file_id, {
      type: item.result.type,
      confidence: Number(item.result.confidence),
    });
  }
  for (const u of uploaded) {
    const r = classifyByFileId.get(u.fileId);
    if (!r) throw new Error(`No classification result for ${u.basename}`);
    console.log(
      `[classify] ${u.basename} -> ${r.type} (${r.confidence.toFixed(3)})`,
    );
  }

  // Sanity: both invoices should be the same type, both contracts too.
  // ---- Phase 2: Per-category Extract (concurrent, cap 2) ----
  const invoiceJsonSchema = stripMeta(z.toJSONSchema(invoiceSchema) as any);
  const contractJsonSchema = stripMeta(z.toJSONSchema(contractSchema) as any);

  const limit = pLimit(2);

  const extractJobs = uploaded.map((u) =>
    limit(async () => {
      const cat = classifyByFileId.get(u.fileId)!;
      const dataSchema =
        cat.type === 'invoice' ? invoiceJsonSchema : contractJsonSchema;
      console.log(`[extract] start ${u.basename} (${cat.type})`);
      const created = await client.extract.create({
        file_input: u.fileId,
        configuration: {
          data_schema: dataSchema as any,
          extraction_target: 'per_doc',
          tier: 'agentic',
        },
      });
      const final = await pollUntilDone(
        () => client.extract.get(created.id),
        (r) => ['COMPLETED', 'FAILED', 'CANCELLED'].includes(r.status),
      );
      if (final.status !== 'COMPLETED') {
        throw new Error(`Extract failed for ${u.basename}: ${final.status}`);
      }
      console.log(`[extract] done  ${u.basename} (${cat.type})`);
      return { basename: u.basename, fileId: u.fileId, cat, final };
    }),
  );

  const completed = await Promise.all(extractJobs);

  // ---- Aggregate artifacts ----
  const results: Record<string, any> = {};
  const logLines: string[] = [];
  for (const c of completed) {
    const data = c.final.extract_result ?? {};
    const nFields = typeof data === 'object' ? Object.keys(data).length : 0;
    results[c.basename] = {
      category: c.cat.type,
      confidence: c.cat.confidence,
      file_id: c.fileId,
      data,
    };
    logLines.push(
      `Routed: ${c.basename} | category: ${c.cat.type} | confidence: ${c.cat.confidence} | fields: ${nFields}`,
    );
  }

  fs.writeFileSync(
    path.join(outputsDir, 'results.json'),
    JSON.stringify(results, null, 2),
  );
  fs.writeFileSync(path.resolve('./output.log'), logLines.join('\n') + '\n');
  console.log('[done] wrote outputs/results.json and output.log');
}

main().catch((err) => {
  console.error('[fatal]', err);
  process.exit(1);
});
