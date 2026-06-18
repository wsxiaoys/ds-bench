import { z } from 'zod';
import { LlamaCloud } from '@llamaindex/llama-cloud';

/**
 * Zod schema for invoice extraction
 */
const invoiceSchema = z.object({
  invoice_number: z.string(),
  invoice_date: z.string(),
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

/**
 * Main extraction function
 */
async function extractInvoice() {
  console.log('Initializing LlamaCloud client...');
  const client = new LlamaCloud({
    apiKey: process.env.LLAMA_CLOUD_API_KEY,
  });

  console.log('Uploading invoice.pdf...');
  const file = await client.files.uploadFile({
    fileInput: {
      fileName: 'invoice.pdf',
      filePath: '/home/user/project/invoice.pdf',
    },
    purpose: 'extract',
  });

  console.log(`File uploaded with ID: ${file.id}`);

  console.log('Creating Extract v2 job with agentic tier...');
  const job = await client.extract.create({
    fileInput: {
      fileId: file.id,
    },
    configuration: {
      dataSchema: invoiceSchema.toJSONSchema(),
      extractionTarget: 'per_doc',
      tier: 'agentic',
    },
  });

  console.log(`Extract job created with ID: ${job.id}`);
  console.log('Polling for job completion...');

  let extractResult: any = null;
  const maxPollingAttempts = 60; // 5 minutes with 5-second intervals
  const pollingInterval = 5000; // 5 seconds

  for (let attempt = 0; attempt < maxPollingAttempts; attempt++) {
    const status = await client.extract.retrieve(job.id);

    console.log(`Attempt ${attempt + 1}/${maxPollingAttempts}: Status = ${status.status}`);

    if (status.status === 'COMPLETED') {
      console.log('Job completed successfully!');
      extractResult = status.extractResult;
      break;
    } else if (status.status === 'FAILED') {
      throw new Error(`Extract job failed: ${status.error || 'Unknown error'}`);
    } else if (status.status === 'CANCELLED') {
      throw new Error('Extract job was cancelled');
    }

    // Wait before polling again
    await new Promise((resolve) => setTimeout(resolve, pollingInterval));
  }

  if (extractResult === null) {
    throw new Error('Job did not complete within the timeout period');
  }

  console.log('Writing results to output.json...');
  const fs = await import('fs');
  fs.writeFileSync(
    '/home/user/project/output.json',
    JSON.stringify(extractResult, null, 2),
    'utf-8'
  );

  console.log('Appending summary to output.log...');
  const summary = `Extracted Invoice: ${extractResult.invoice_number} | Vendor: ${extractResult.vendor_name} | Total: ${extractResult.total_amount}\n`;
  fs.appendFileSync('/home/user/project/output.log', summary, 'utf-8');

  console.log('Extraction completed successfully!');
  console.log(`Invoice Number: ${extractResult.invoice_number}`);
  console.log(`Vendor: ${extractResult.vendor_name}`);
  console.log(`Total Amount: ${extractResult.total_amount}`);
  console.log(`Line Items: ${extractResult.line_items?.length || 0}`);
}

// Run the extraction
extractInvoice().catch((error) => {
  console.error('Error during extraction:', error);
  process.exit(1);
});