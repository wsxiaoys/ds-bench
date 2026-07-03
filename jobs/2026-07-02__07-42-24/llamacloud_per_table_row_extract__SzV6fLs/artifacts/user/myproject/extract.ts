import fs from 'fs';
import z from 'zod/v4';
import { LlamaCloud } from '@llamaindex/llama-cloud';

async function main() {
  // 1. Read run ID
  const runIdPath = '/logs/artifacts/run-id';
  if (!fs.existsSync(runIdPath)) {
    throw new Error(`Run ID file not found at ${runIdPath}`);
  }
  const runId = fs.readFileSync(runIdPath, 'utf8').trim();
  console.log(`Using run ID: ${runId}`);

  // 2. Verify API key
  const apiKey = process.env.LLAMA_CLOUD_API_KEY;
  if (!apiKey) {
    throw new Error('LLAMA_CLOUD_API_KEY environment variable is not set');
  }

  // 3. Initialize LlamaCloud client
  const client = new LlamaCloud({ apiKey });

  // 4. Define Zod schema and convert to JSON Schema
  const schema = z.object({
    product_code: z.string(),
    product_name: z.string(),
    category: z.string(),
    price_usd: z.number(),
    stock: z.number().int(),
  });

  const data_schema = z.toJSONSchema(schema);
  console.log('JSON Schema generated:', JSON.stringify(data_schema, null, 2));

  // 5. Upload source PDF
  const pdfPath = '/home/user/myproject/data/products.pdf';
  if (!fs.existsSync(pdfPath)) {
    throw new Error(`PDF file not found at ${pdfPath}`);
  }

  console.log('Uploading PDF...');
  const fileStream = fs.createReadStream(pdfPath);
  const fileUpload = await client.files.create({
    file: fileStream,
    purpose: 'extract',
    external_file_id: `products-${runId}.pdf`,
  });

  const fileId = fileUpload.id;
  console.log(`Uploaded file ID: ${fileId}`);

  // 6. Submit extraction job
  console.log('Submitting extraction job...');
  let job = await client.extract.create({
    file_input: fileId,
    configuration: {
      data_schema: data_schema as any,
      extraction_target: 'per_table_row',
      tier: 'agentic',
    },
  });

  const jobId = job.id;
  console.log(`Job ID: ${jobId}, Initial status: ${job.status}`);

  // 7. Poll until terminal status
  const terminalStatuses = ['COMPLETED', 'FAILED', 'CANCELLED'];
  while (!terminalStatuses.includes(job.status)) {
    console.log(`Polling... current status: ${job.status}`);
    await new Promise((resolve) => setTimeout(resolve, 2000));
    job = await client.extract.get(jobId);
  }

  console.log(`Job finished with status: ${job.status}`);

  if (job.status !== 'COMPLETED') {
    throw new Error(`Job failed or cancelled: ${job.error_message || 'No error message provided'}`);
  }

  // 8. Write extraction result to output.json
  const result = job.extract_result;
  if (!result) {
    throw new Error('Completed job has no extract_result');
  }

  const outputPath = '/home/user/myproject/output.json';
  fs.writeFileSync(outputPath, JSON.stringify(result, null, 2), 'utf8');
  console.log(`Wrote output to ${outputPath}`);

  // 9. Append a single log line to output.log
  const logPath = '/home/user/myproject/output.log';
  const numRows = Array.isArray(result) ? result.length : 0;
  fs.appendFileSync(logPath, `Extracted rows: ${numRows}\n`, 'utf8');
  console.log(`Appended log to ${logPath}`);
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
