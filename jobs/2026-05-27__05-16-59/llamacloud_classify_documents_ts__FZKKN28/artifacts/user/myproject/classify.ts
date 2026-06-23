import LlamaCloud from '@llamaindex/llama-cloud';
import fs from 'fs';
import path from 'path';

async function main() {
  const runId = process.env.ZEALT_RUN_ID || 'unknown';
  const logPath = '/home/user/myproject/output.log';
  const logStream = fs.createWriteStream(logPath);

  logStream.write(`Run ID: ${runId}\n`);

  const client = new LlamaCloud();

  const samplesDir = '/home/user/myproject/samples';
  const sampleFiles = ['invoice.txt', 'receipt.txt', 'contract.txt'];
  const fileIds: string[] = [];

  console.log('Uploading files...');
  for (const fileName of sampleFiles) {
    const filePath = path.join(samplesDir, fileName);
    const fileStream = fs.createReadStream(filePath);
    const uploadedFile = await client.files.create({
      file: fileStream,
      purpose: 'classify',
    });
    fileIds.push(uploadedFile.id);
    console.log(`Uploaded ${fileName} with ID ${uploadedFile.id}`);
  }

  console.log('Submitting classification job...');
  const results = await client.classifier.classify({
    file_ids: fileIds,
    mode: 'FAST',
    rules: [
      { type: 'invoice', description: 'A commercial invoice with invoice number, bill-to section, line items, and totals.' },
      { type: 'receipt', description: 'A short point-of-sale receipt.' },
      { type: 'contract', description: 'A legal services agreement with signatures.' },
    ],
  });

  console.log('Job completed. Logging results...');
  for (let i = 0; i < results.items.length; i++) {
    const item = results.items[i];
    const fileName = sampleFiles[i];
    const type = item.result?.type || 'unknown';
    const confidence = item.result?.confidence ?? 0;
    
    logStream.write(`Classified: ${fileName} | Type: ${type} | Confidence: ${confidence}\n`);
    console.log(`Classified: ${fileName} | Type: ${type} | Confidence: ${confidence}`);
  }

  logStream.end();
  console.log(`Done. Results written to ${logPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
