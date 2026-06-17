import fs from 'node:fs';
import path from 'node:path';
import { LlamaCloud } from '@llamaindex/llama-cloud';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import pLimit from 'p-limit';

// Add toJSONSchema to zod as requested in requirements
(z as any).toJSONSchema = zodToJsonSchema;

const INVOICES_DIR = '/home/user/myproject/invoices';
const RESULTS_FILE = '/home/user/myproject/results.json';
const LOG_FILE = '/home/user/myproject/output.log';

const InvoiceSchema = z.object({
  vendor_name: z.string(),
  invoice_number: z.string(),
  total_amount: z.number(),
  currency: z.string().length(3),
});

async function main() {
  const apiKey = process.env.LLAMA_CLOUD_API_KEY;
  if (!apiKey) {
    throw new Error('LLAMA_CLOUD_API_KEY is not set');
  }

  const client = new LlamaCloud({ token: apiKey });

  if (!fs.existsSync(INVOICES_DIR)) {
    console.error(`Directory not found: ${INVOICES_DIR}`);
    process.exit(1);
  }

  const files = fs.readdirSync(INVOICES_DIR).filter(f => f.toLowerCase().endsWith('.pdf'));
  
  const limit = pLimit(3);
  const results: any[] = [];
  let successCount = 0;
  let failedCount = 0;

  // Open log file for writing
  const logStream = fs.createWriteStream(LOG_FILE);

  const tasks = files.map(file => limit(async () => {
    const filePath = path.join(INVOICES_DIR, file);
    try {
      // 1. Upload file
      const uploadedFile = await client.files.create({
        file: fs.createReadStream(filePath),
        purpose: 'extract',
      });

      // 2. Create extract job
      const schema = (z as any).toJSONSchema(InvoiceSchema);
      if (typeof schema === 'object' && schema !== null) {
        delete (schema as any).$schema;
      }

      const job = await client.extract.create({
        file_input: uploadedFile.id,
        configuration: {
          data_schema: schema,
          extraction_target: 'per_doc',
          tier: 'cost_effective',
        },
      });

      // 3. Poll for completion
      const start = Date.now();
      const timeout = 240 * 1000;
      let currentJob = job;

      while (true) {
        if (currentJob.status === 'COMPLETED') {
          const data = currentJob.extract_result;
          results.push({
            file,
            status: 'success',
            data,
          });
          successCount++;
          const logLine = `PROCESSED ${file}: success`;
          console.log(logLine);
          logStream.write(logLine + '\n');
          break;
        } else if (currentJob.status === 'FAILED' || currentJob.status === 'CANCELLED') {
          throw new Error(`Job ended with status: ${currentJob.status}`);
        }

        if (Date.now() - start > timeout) {
          throw new Error('Polling timeout');
        }

        // Wait before next poll
        await new Promise(resolve => setTimeout(resolve, 5000));
        currentJob = await client.extract.get(currentJob.id);
      }
    } catch (error: any) {
      results.push({
        file,
        status: 'error',
        error: error.message || String(error),
      });
      failedCount++;
      const logLine = `PROCESSED ${file}: error`;
      console.log(logLine);
      logStream.write(logLine + '\n');
    }
  }));

  await Promise.all(tasks);

  // Write results to JSON file
  fs.writeFileSync(RESULTS_FILE, JSON.stringify(results, null, 2));

  // Write summary
  const summary = `SUMMARY total=${files.length} success=${successCount} failed=${failedCount}`;
  console.log(summary);
  logStream.write(summary + '\n');
  logStream.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
