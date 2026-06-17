import fs from 'fs';
import path from 'path';
import { LlamaCloud } from '@llamaindex/llama-cloud';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import pLimit from 'p-limit';

const ZEALT_RUN_ID = process.env.ZEALT_RUN_ID || 'test-run';
const INPUT_DIR = './inputs';
const OUTPUT_DIR = './outputs';
const LOG_FILE = './output.log';

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR);
}

const invoiceSchema = z.object({
  invoice_number: z.string(),
  vendor_name: z.string(),
  total_amount: z.number(),
  line_items: z.array(
    z.object({
      description: z.string(),
      quantity: z.number(),
      unit_price: z.number(),
      total: z.number(),
    })
  ),
});

const contractSchema = z.object({
  parties: z.array(z.string()).min(2),
  effective_date: z.string(),
  term: z.string(),
});

const client = new LlamaCloud({
  apiKey: process.env.LLAMA_CLOUD_API_KEY,
});

async function main() {
  const files = fs.readdirSync(INPUT_DIR).filter((f) => f.endsWith('.pdf'));
  console.log(`Found ${files.length} files: ${files.join(', ')}`);

  // Phase 1: Upload and Classify
  const fileIdMap = new Map<string, string>();
  const uploadedFiles = await Promise.all(
    files.map(async (filename) => {
      const filePath = path.join(INPUT_DIR, filename);
      const basename = path.parse(filename).name;
      const external_file_id = `${ZEALT_RUN_ID}-${basename}`;

      console.log(`Uploading ${filename} with external_file_id: ${external_file_id}`);
      const fileStream = fs.createReadStream(filePath);
      const uploadedFile = await client.files.create({
        file: fileStream as any,
        purpose: 'extract',
        external_file_id,
      });

      fileIdMap.set(uploadedFile.id, filename);
      return uploadedFile;
    })
  );

  const fileIds = uploadedFiles.map((f) => f.id);

  console.log('Running Classify job...');
  const classifyResult = await client.classifier.classify({
    file_ids: fileIds,
    rules: [
      {
        type: 'invoice',
        description: 'commercial invoice with an invoice number, line items, and a grand total',
      },
      {
        type: 'contract',
        description: 'legal agreement signed by two or more parties with an effective date and term',
      },
    ],
    mode: 'FAST',
  });

  const classificationMap = new Map<string, { category: string; confidence: number }>();
  for (const item of classifyResult.items) {
    classificationMap.set(item.file_id, {
      category: item.result?.type || 'unknown',
      confidence: item.result?.confidence || 0,
    });
  }

  // Phase 2: Per-category Extract
  const limit = pLimit(2);
  const results: Record<string, any> = {};
  const logLines: string[] = [];

  const extractJobs = Array.from(classificationMap.entries()).map(([fileId, info]) =>
    limit(async () => {
      const filename = fileIdMap.get(fileId)!;
      const jsonSchema = info.category === 'invoice' 
        ? {
            type: 'object',
            properties: {
              invoice_number: { type: 'string' },
              vendor_name: { type: 'string' },
              total_amount: { type: 'number' },
              line_items: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    description: { type: 'string' },
                    quantity: { type: 'number' },
                    unit_price: { type: 'number' },
                    total: { type: 'number' },
                  },
                  required: ['description', 'quantity', 'unit_price', 'total'],
                },
              },
            },
            required: ['invoice_number', 'vendor_name', 'total_amount', 'line_items'],
          }
        : {
            type: 'object',
            properties: {
              parties: { type: 'array', items: { type: 'string' }, minItems: 2 },
              effective_date: { type: 'string' },
              term: { type: 'string' },
            },
            required: ['parties', 'effective_date', 'term'],
          };

      console.log(`Starting Extract for ${filename} as ${info.category}...`);
      const extractJob = await client.extract.create({
        file_input: fileId,
        configuration: {
          data_schema: jsonSchema as any,
          extraction_target: 'per_doc',
          tier: 'agentic',
        },
      });

      let job = await client.extract.get(extractJob.id);
      while (job.status === 'PENDING' || job.status === 'IN_PROGRESS' || job.status === 'RUNNING') {
        await new Promise((r) => setTimeout(r, 2000));
        job = await client.extract.get(extractJob.id);
      }

      if (job.status !== 'COMPLETED') {
        throw new Error(`Extract job for ${filename} failed with status ${job.status}`);
      }

      const data = job.extract_result;
      results[filename] = {
        category: info.category,
        confidence: info.confidence,
        file_id: fileId,
        data: data,
      };

      const fieldCount = Object.keys(data || {}).length;
      logLines.push(`Routed: ${filename} | category: ${info.category} | confidence: ${info.confidence} | fields: ${fieldCount}`);
      console.log(`Completed Extract for ${filename}`);
    })
  );

  await Promise.all(extractJobs);

  fs.writeFileSync(path.join(OUTPUT_DIR, 'results.json'), JSON.stringify(results, null, 2));
  fs.writeFileSync(LOG_FILE, logLines.join('\n') + '\n');

  console.log('Finished successfully.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
