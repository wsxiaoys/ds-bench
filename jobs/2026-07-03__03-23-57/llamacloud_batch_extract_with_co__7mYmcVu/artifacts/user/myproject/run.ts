import fs from 'fs';
import path from 'path';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import LlamaCloud from '@llamaindex/llama-cloud';
import pLimit from 'p-limit';

// Polyfill z.toJSONSchema if it doesn't exist
if (typeof (z as any).toJSONSchema !== 'function') {
  (z as any).toJSONSchema = function (schema: any) {
    return zodToJsonSchema(schema);
  };
}

const Invoice = z.object({
  vendor_name: z.string().describe("The name of the vendor"),
  invoice_number: z.string().describe("The invoice number"),
  total_amount: z.number().describe("The total amount of the invoice"),
  currency: z.string().length(3).describe("The 3-letter ISO currency code"),
});

const jsonSchema = (z as any).toJSONSchema(Invoice);

const client = new LlamaCloud({
  apiKey: process.env.LLAMA_CLOUD_API_KEY,
});

async function processFile(filePath: string) {
  const basename = path.basename(filePath);
  try {
    console.log(`[START] Uploading ${basename}...`);
    const fileObj = await client.files.create({
      file: fs.createReadStream(filePath),
      purpose: 'extract',
    });
    console.log(`[UPLOADED] ${basename} -> file_id: ${fileObj.id}`);

    console.log(`[START] Creating extraction job for ${basename}...`);
    const job = await client.extract.create({
      file_input: fileObj.id,
      configuration: {
        data_schema: jsonSchema,
        extraction_target: 'per_doc',
        tier: 'cost_effective',
      },
    });
    console.log(`[CREATED] ${basename} -> job_id: ${job.id}`);

    console.log(`[START] Polling job for ${basename}...`);
    const startTime = Date.now();
    let currentJob = job;
    while (currentJob.status !== 'COMPLETED' && currentJob.status !== 'FAILED' && currentJob.status !== 'CANCELLED') {
      if (Date.now() - startTime > 240000) { // 240 seconds timeout
        throw new Error('Polling timeout: Job did not complete within 240 seconds');
      }
      await new Promise(resolve => setTimeout(resolve, 5000));
      currentJob = await client.extract.get(job.id);
      console.log(`[POLL] ${basename} -> status: ${currentJob.status}`);
    }

    if (currentJob.status === 'FAILED') {
      throw new Error(`Extraction job failed: ${currentJob.error_message || 'Unknown error'}`);
    }
    if (currentJob.status === 'CANCELLED') {
      throw new Error('Extraction job was cancelled');
    }

    // Success!
    let extractedData = currentJob.extract_result;
    if (Array.isArray(extractedData)) {
      extractedData = extractedData[0];
    }

    // Ensure the data conforms to the schema
    const parsed = Invoice.safeParse(extractedData);
    let finalData;
    if (parsed.success) {
      finalData = parsed.data;
    } else {
      console.warn(`[WARN] Zod validation failed for ${basename}, falling back to manual mapping:`, parsed.error);
      // Fallback manual mapping with type safety
      const vendor_name = String(extractedData?.vendor_name || '');
      const invoice_number = String(extractedData?.invoice_number || '');
      let total_amount = 0;
      if (typeof extractedData?.total_amount === 'number') {
        total_amount = extractedData.total_amount;
      } else if (extractedData?.total_amount) {
        total_amount = parseFloat(String(extractedData.total_amount).replace(/[^0-9.-]/g, ''));
      }
      const currency = String(extractedData?.currency || '').substring(0, 3).toUpperCase();
      finalData = {
        vendor_name,
        invoice_number,
        total_amount: isNaN(total_amount) ? 0 : total_amount,
        currency,
      };
    }

    return {
      file: basename,
      status: 'success' as const,
      data: finalData,
    };
  } catch (error: any) {
    console.error(`[ERROR] Failed to process ${basename}:`, error);
    return {
      file: basename,
      status: 'error' as const,
      error: error?.message || String(error),
    };
  }
}

async function main() {
  const invoicesDir = '/home/user/myproject/invoices';
  const resultsPath = '/home/user/myproject/results.json';
  const logPath = '/home/user/myproject/output.log';

  if (!fs.existsSync(invoicesDir)) {
    console.error(`Invoices directory not found: ${invoicesDir}`);
    process.exit(1);
  }

  const files = fs.readdirSync(invoicesDir);
  const pdfFiles = files
    .filter(f => f.toLowerCase().endsWith('.pdf'))
    .map(f => path.join(invoicesDir, f));

  console.log(`Found ${pdfFiles.length} PDF files to process.`);

  const limit = pLimit(3);
  const tasks = pdfFiles.map(filePath => {
    return limit(() => processFile(filePath));
  });

  const results = await Promise.all(tasks);

  // Write results.json
  fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2), 'utf-8');
  console.log(`Results written to ${resultsPath}`);

  // Construct output log content
  let logContent = '';
  let successCount = 0;
  let failedCount = 0;

  for (const res of results) {
    logContent += `PROCESSED ${res.file}: ${res.status}\n`;
    if (res.status === 'success') {
      successCount++;
    } else {
      failedCount++;
    }
  }

  const summaryLine = `SUMMARY total=${results.length} success=${successCount} failed=${failedCount}`;
  logContent += summaryLine + '\n';

  fs.writeFileSync(logPath, logContent, 'utf-8');
  console.log(`Log written to ${logPath}`);
  console.log(summaryLine);
}

main().catch(err => {
  console.error('Unhandled error in main execution:', err);
  process.exit(1);
});
