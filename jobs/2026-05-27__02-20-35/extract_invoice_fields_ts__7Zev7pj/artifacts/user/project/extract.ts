import { LlamaCloud } from '@llamaindex/llama-cloud';
import { z } from 'zod';
import * as fs from 'fs';

const schema = z.object({
  invoice_number: z.string(),
  invoice_date: z.string(),
  vendor_name: z.string(),
  total_amount: z.number(),
  line_items: z.array(z.object({
    description: z.string(),
    quantity: z.number(),
    unit_price: z.number(),
    total: z.number()
  }))
});

async function main() {
  const client = new LlamaCloud();
  
  console.log('Uploading file...');
  const file = await client.files.create({
    file: fs.createReadStream('invoice.pdf'),
    purpose: 'extract'
  });
  console.log('File uploaded, ID:', file.id);

  console.log('Running extraction job...');
  const job = await client.extract.run({
    file_input: file.id,
    configuration: {
      data_schema: z.toJSONSchema(schema) as any,
      extraction_target: 'per_doc',
      tier: 'agentic'
    }
  });

  const result = job.extract_result;
  console.log('Extraction job completed.');
  
  // Write output.json
  fs.writeFileSync('output.json', JSON.stringify(result, null, 2));
  
  // Write output.log
  const invoiceNumber = (result as any)?.invoice_number || 'UNKNOWN';
  const vendorName = (result as any)?.vendor_name || 'UNKNOWN';
  const totalAmount = (result as any)?.total_amount || 0;
  
  const logLine = `Extracted Invoice: ${invoiceNumber} | Vendor: ${vendorName} | Total: ${totalAmount}\n`;
  fs.writeFileSync('output.log', logLine);
  
  console.log('Done.');
}

main().catch(console.error);
