import LlamaCloud from '@llamaindex/llama-cloud';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  // Initialize the client (picks up LLAMA_CLOUD_API_KEY from environment)
  const client = new LlamaCloud();

  // Define the sample files
  const sampleFiles = [
    'samples/invoice.txt',
    'samples/receipt.txt',
    'samples/contract.txt'
  ];

  // Upload each file to LlamaCloud with purpose="classify"
  const fileIdMap = new Map<string, string>(); // file ID -> file name mapping

  console.log('Uploading files to LlamaCloud...');

  for (const filePath of sampleFiles) {
    const fullPath = path.join(process.cwd(), filePath);
    const fileName = path.basename(filePath);

    // Create a read stream for the file
    const fileStream = fs.createReadStream(fullPath);

    // Upload the file with purpose="classify"
    const uploadedFile = await client.files.create({
      file: fileStream,
      purpose: 'classify'
    });

    console.log(`Uploaded ${fileName} with ID: ${uploadedFile.id}`);
    fileIdMap.set(uploadedFile.id, fileName);
  }

  console.log('All files uploaded successfully.');

  // Define classification rules
  const rules = [
    {
      type: 'invoice',
      description: 'Commercial invoice with invoice number, bill-to/from addresses, detailed line items with hourly rates or prices, subtotal, tax calculation, and total due amount'
    },
    {
      type: 'receipt',
      description: 'Point-of-sale or transaction receipt showing store name, date/time, list of individual items with prices, subtotal, tax, and total payment amount with payment method'
    },
    {
      type: 'contract',
      description: 'Legal agreement or contract document with parties involved, terms and conditions, clauses, and signature blocks for authorized representatives'
    }
  ];

  console.log('Starting classification job in FAST mode...');

  // Submit a Classify job using the convenience helper
  const results = await client.classifier.classify({
    file_ids: Array.from(fileIdMap.keys()),
    rules: rules,
    mode: 'FAST'
  });

  console.log('Classification completed successfully.');

  // Write results to output.log
  const outputPath = path.join(process.cwd(), 'output.log');
  const logLines: string[] = [];

  // First line: Run ID from ZEALT_RUN_ID environment variable
  const runId = process.env.ZEALT_RUN_ID || 'unknown';
  logLines.push(`Run ID: ${runId}`);

  // Process results and create log entries in the original file order
  for (const filePath of sampleFiles) {
    const fileName = path.basename(filePath);

    // Find the corresponding result by file ID
    for (const item of results.items) {
      if (item.file_id && fileIdMap.get(item.file_id) === fileName && item.result && item.result.type) {
        const confidence = item.result.confidence;
        logLines.push(`Classified: ${fileName} | Type: ${item.result.type} | Confidence: ${confidence}`);
        break;
      }
    }
  }

  // Write to log file
  fs.writeFileSync(outputPath, logLines.join('\n'), 'utf-8');

  console.log(`Results written to ${outputPath}`);
  console.log('Log contents:');
  console.log(logLines.join('\n'));
}

main().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});