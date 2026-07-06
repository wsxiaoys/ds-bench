import fs from 'fs';
import path from 'path';
import LlamaCloud from '@llamaindex/llama-cloud';

async function main() {
  const runIdPath = '/logs/artifacts/run-id';
  let runId = '';
  try {
    runId = fs.readFileSync(runIdPath, 'utf-8').trim();
  } catch (err) {
    console.error(`Warning: Could not read run-id from ${runIdPath}`, err);
  }

  const client = new LlamaCloud();

  const filesToUpload = [
    { filePath: '/home/user/myproject/samples/invoice.txt', basename: 'invoice.txt' },
    { filePath: '/home/user/myproject/samples/receipt.txt', basename: 'receipt.txt' },
    { filePath: '/home/user/myproject/samples/contract.txt', basename: 'contract.txt' },
  ];

  console.log('Uploading files to LlamaCloud...');
  const uploadedFiles = [];
  for (const f of filesToUpload) {
    console.log(`Uploading ${f.basename}...`);
    const uploadResult = await client.files.create({
      file: fs.createReadStream(f.filePath),
      purpose: 'classify',
    });
    console.log(`Uploaded ${f.basename} with ID: ${uploadResult.id}`);
    uploadedFiles.push({
      id: uploadResult.id,
      basename: f.basename,
    });
  }

  const fileIds = uploadedFiles.map(uf => uf.id);

  const rules = [
    {
      type: 'invoice',
      description: 'A commercial invoice showing details of a transaction, invoice number, bill-to section, line items, and total due.',
    },
    {
      type: 'receipt',
      description: 'A point-of-sale receipt with details of a purchase, store name, items bought, and transaction totals.',
    },
    {
      type: 'contract',
      description: 'A legal services agreement or contract with terms, conditions, and signature blocks.',
    },
  ];

  console.log('Submitting Classify job in FAST mode...');
  const results = await client.classifier.classify({
    file_ids: fileIds,
    rules: rules,
    mode: 'FAST',
  });

  console.log('Job completed. Processing results...');

  const outputLines: string[] = [];
  outputLines.push(`Run ID: ${runId}`);

  for (let i = 0; i < results.items.length; i++) {
    const item = results.items[i];
    const matchingFile = uploadedFiles.find(uf => uf.id === item.file_id) || uploadedFiles[i];
    const basename = matchingFile ? matchingFile.basename : 'unknown';
    const type = item.result?.type ?? 'unknown';
    const confidence = item.result?.confidence ?? 0;
    
    outputLines.push(`Classified: ${basename} | Type: ${type} | Confidence: ${confidence}`);
  }

  const outputPath = '/home/user/myproject/output.log';
  fs.writeFileSync(outputPath, outputLines.join('\n') + '\n');
  console.log(`Results written to ${outputPath}`);
}

main().catch(err => {
  console.error('Error in classification process:', err);
  process.exit(1);
});
