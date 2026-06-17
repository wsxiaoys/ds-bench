import fs from 'fs';
import path from 'path';
import { LlamaCloud } from '@llamaindex/llama-cloud';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import pLimit from 'p-limit';
import { globSync } from 'glob';

const client = new LlamaCloud({
  token: process.env.LLAMA_CLOUD_API_KEY,
});

const Invoice = z.object({
  vendor_name: z.string(),
  invoice_number: z.string(),
  total_amount: z.number(),
  currency: z.string().length(3),
});

const jsonSchema = zodToJsonSchema(Invoice) as any; // equivalent to z.toJSONSchema(...)
delete jsonSchema.$schema;

const INVOICES_DIR = '/home/user/myproject/invoices';
const RESULTS_FILE = '/home/user/myproject/results.json';
const LOG_FILE = '/home/user/myproject/output.log';

const logStream = fs.createWriteStream(LOG_FILE, { flags: 'w' });

function log(message: string) {
  console.log(message);
  logStream.write(message + '\n');
}

interface ResultEntry {
  file: string;
  status: 'success' | 'error';
  data?: any;
  error?: string;
}

async function processFile(filePath: string): Promise<ResultEntry> {
  const fileName = path.basename(filePath);
  try {
    const fileStream = fs.createReadStream(filePath);
    const fileUpload = await client.files.create({
      file: fileStream as any,
      purpose: 'extract',
    } as any);
    
    const fileId = fileUpload.id;
    
    const job = await client.extract.create({
      fileInput: fileId, // Use camelCase as it might be what LlamaCloud expects natively
      configuration: {
        dataSchema: jsonSchema,
        extractionTarget: 'per_doc',
        tier: 'cost_effective',
      }
    } as any).catch(async (e) => {
        // Try snake_case if camelCase fails
        return await client.extract.create({
            file_input: fileId,
            configuration: {
                data_schema: jsonSchema,
                extraction_target: 'per_doc',
                tier: 'cost_effective',
            }
        } as any);
    });

    const jobId = job.id;
    const startTime = Date.now();
    const TIMEOUT_MS = 240 * 1000;
    
    while (true) {
      if (Date.now() - startTime > TIMEOUT_MS) {
        return { file: fileName, status: 'error', error: 'Timeout' };
      }
      
      const jobStatus = await client.extract.get(jobId);
      if (jobStatus.status === 'COMPLETED') {
        return { file: fileName, status: 'success', data: jobStatus.extract_result || jobStatus.extractResult || jobStatus.data };
      } else if (jobStatus.status === 'FAILED' || jobStatus.status === 'CANCELLED') {
        return { file: fileName, status: 'error', error: `Job ${jobStatus.status}` };
      }
      
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  } catch (e: any) {
    return { file: fileName, status: 'error', error: e.message || String(e) };
  }
}

async function main() {
  const files = globSync(`${INVOICES_DIR}/**/*.pdf`, { nocase: true });
  const limit = pLimit(3);
  
  const results: ResultEntry[] = [];
  let successCount = 0;
  let failedCount = 0;
  
  const promises = files.map(file => limit(async () => {
    const result = await processFile(file);
    results.push(result);
    log(`PROCESSED ${result.file}: ${result.status}`);
    if (result.status === 'success') {
      successCount++;
    } else {
      failedCount++;
    }
  }));
  
  await Promise.all(promises);
  
  fs.writeFileSync(RESULTS_FILE, JSON.stringify(results, null, 2));
  log(`SUMMARY total=${files.length} success=${successCount} failed=${failedCount}`);
  logStream.end();
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
