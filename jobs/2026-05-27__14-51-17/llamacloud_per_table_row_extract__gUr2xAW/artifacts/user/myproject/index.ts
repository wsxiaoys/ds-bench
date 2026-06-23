import { LlamaCloud } from '@llamaindex/llama-cloud';
import { z } from 'zod';
import { createReadStream } from 'fs';
import { writeFile, appendFile } from 'fs/promises';
import { resolve } from 'path';

// Read environment variables
const LLAMA_CLOUD_API_KEY = process.env.LLAMA_CLOUD_API_KEY;
const ZEALT_RUN_ID = process.env.ZEALT_RUN_ID;

if (!LLAMA_CLOUD_API_KEY) {
  throw new Error('LLAMA_CLOUD_API_KEY environment variable is required');
}

if (!ZEALT_RUN_ID) {
  throw new Error('ZEALT_RUN_ID environment variable is required');
}

// Define the Zod schema for a single product row
const ProductRowSchema = z.object({
  product_code: z.string(),
  product_name: z.string(),
  category: z.string(),
  price_usd: z.number(),
  stock: z.number().int(),
});

// Convert Zod schema to JSON Schema (manual conversion for Zod v3)
const dataSchema = {
  type: 'object',
  properties: {
    product_code: { type: 'string' },
    product_name: { type: 'string' },
    category: { type: 'string' },
    price_usd: { type: 'number' },
    stock: { type: 'integer' },
  },
  required: ['product_code', 'product_name', 'category', 'price_usd', 'stock'],
};

// Initialize the LlamaCloud client
const client = new LlamaCloud({
  apiKey: LLAMA_CLOUD_API_KEY,
});

// Paths
const pdfPath = resolve('/home/user/myproject/data/products.pdf');
const outputPath = resolve('/home/user/myproject/output.json');
const logPath = resolve('/home/user/myproject/output.log');

async function main() {
  console.log('Starting extraction process...');

  // Step 1: Check if file already exists, otherwise upload it
  console.log('Checking for existing file...');
  const externalFileId = `products-${ZEALT_RUN_ID}.pdf`;
  let uploadedFile;
  
  try {
    // Try to find existing file by external_file_id
    const existingFiles = await client.files.list({
      external_file_id: externalFileId,
    });
    
    if (existingFiles.items && existingFiles.items.length > 0) {
      uploadedFile = existingFiles.items[0];
      console.log(`Found existing file with ID: ${uploadedFile.id}`);
    } else {
      // Upload the PDF file
      console.log('Uploading PDF file...');
      const fileStream = createReadStream(pdfPath);
      uploadedFile = await client.files.create({
        file: fileStream,
        purpose: 'extract',
        external_file_id: externalFileId,
      });
      console.log(`File uploaded successfully with ID: ${uploadedFile.id}`);
    }
  } catch (error) {
    // If list fails, try to upload directly
    console.log('Uploading PDF file...');
    const fileStream = createReadStream(pdfPath);
    uploadedFile = await client.files.create({
      file: fileStream,
      purpose: 'extract',
      external_file_id: externalFileId,
    });
    console.log(`File uploaded successfully with ID: ${uploadedFile.id}`);
  }

  // Step 2: Submit extraction job
  console.log('Submitting extraction job...');
  const job = await client.extract.create({
    file_input: uploadedFile.id,
    configuration: {
      data_schema: dataSchema,
      extraction_target: 'per_table_row',
      tier: 'agentic',
    },
  });
  console.log(`Extraction job created with ID: ${job.id}`);

  // Step 3: Poll until terminal status
  console.log('Polling for job completion...');
  let currentJob = job;
  const terminalStatuses = ['COMPLETED', 'FAILED', 'CANCELLED'];
  
  while (!terminalStatuses.includes(currentJob.status)) {
    await new Promise(resolve => setTimeout(resolve, 2000)); // Sleep for 2 seconds
    currentJob = await client.extract.get(currentJob.id);
    console.log(`Job status: ${currentJob.status}`);
  }

  console.log(`Job completed with status: ${currentJob.status}`);

  // Step 4: Handle the result
  if (currentJob.status === 'COMPLETED') {
    const extractResult = currentJob.extract_result;
    
    // Validate that extract_result is an array
    if (!Array.isArray(extractResult)) {
      throw new Error('Expected extract_result to be an array for per_table_row extraction');
    }

    const numRows = extractResult.length;
    console.log(`Extracted ${numRows} rows`);

    // Step 5: Write results to output.json
    await writeFile(outputPath, JSON.stringify(extractResult, null, 2), 'utf8');
    console.log(`Results written to ${outputPath}`);

    // Step 6: Write log to output.log
    await appendFile(logPath, `Extracted rows: ${numRows}\n`, 'utf8');
    console.log(`Log written to ${logPath}`);

    console.log('Extraction completed successfully!');
  } else {
    throw new Error(`Extraction failed with status: ${currentJob.status}${currentJob.error_message ? ` - ${currentJob.error_message}` : ''}`);
  }
}

main().catch(error => {
  console.error('Error during extraction:', error);
  process.exit(1);
});