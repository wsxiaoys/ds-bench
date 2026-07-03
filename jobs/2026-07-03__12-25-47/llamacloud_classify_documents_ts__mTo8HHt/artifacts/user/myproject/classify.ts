import fs from 'fs';
import path from 'path';
import LlamaCloud from '@llamaindex/llama-cloud';

async function main() {
  const client = new LlamaCloud();

  const samplesDir = path.join(process.cwd(), 'samples');
  const filePaths = [
    path.join(samplesDir, 'invoice.txt'),
    path.join(samplesDir, 'receipt.txt'),
    path.join(samplesDir, 'contract.txt'),
  ];

  // Upload files
  const fileIds: string[] = [];
  const basenames: string[] = [];
  for (const fp of filePaths) {
    const stream = fs.createReadStream(fp);
    const uploaded = await client.files.create({
      file: stream,
      purpose: 'classify',
    });
    fileIds.push(uploaded.id);
    basenames.push(path.basename(fp));
    console.log(`Uploaded ${path.basename(fp)} as ${uploaded.id}`);
  }

  // Submit classify job
  const rules = [
    {
      type: 'invoice',
      description:
        'A commercial invoice issued by a seller to a buyer. It contains an invoice number, invoice date, due date, bill-to section, line items with quantities and unit prices, subtotal, tax, and total amount due. It requests payment for goods or services rendered.',
    },
    {
      type: 'receipt',
      description:
        'A point-of-sale or purchase receipt given to a customer at the time of payment. It contains a store name and address, date and time, cashier name, a short list of items purchased with prices, subtotal, tax, total, payment method (e.g., credit card last 4 digits), and a thank-you message.',
    },
    {
      type: 'contract',
      description:
        'A formal legal agreement or services agreement between two or more parties. It contains an effective date, definitions, numbered clauses describing services, term, compensation, confidentiality, governing law, signature blocks with names and titles for each party.',
    },
  ];

  const results = await client.classifier.classify({
    file_ids: fileIds,
    rules,
    mode: 'FAST',
  });

  // Read run id
  const runId = fs.readFileSync('/logs/artifacts/run-id', 'utf8').trim();

  // Build log lines
  const lines: string[] = [];
  lines.push(`Run ID: ${runId}`);
  for (let i = 0; i < results.items.length; i++) {
    const item = results.items[i];
    const basename = basenames[i];
    const type = item.result?.type ?? 'unknown';
    const confidence = item.result?.confidence ?? 0;
    lines.push(
      `Classified: ${basename} | Type: ${type} | Confidence: ${confidence}`,
    );
  }

  const output = lines.join('\n') + '\n';
  const outPath = path.join(process.cwd(), 'output.log');
  fs.writeFileSync(outPath, output);
  console.log('Wrote', outPath);
  console.log(output);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
