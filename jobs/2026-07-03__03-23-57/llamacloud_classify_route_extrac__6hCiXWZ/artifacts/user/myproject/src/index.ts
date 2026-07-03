import fs from 'fs';
import path from 'path';
import { LlamaCloud } from '@llamaindex/llama-cloud';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import pLimit from 'p-limit';

const INPUT_DIR = '/home/user/myproject/inputs';
const OUTPUT_DIR = '/home/user/myproject/outputs';
const LOG_FILE = '/home/user/myproject/output.log';

// Define Zod schemas
const invoiceSchema = z.object({
  invoice_number: z.string(),
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

const contractSchema = z.object({
  parties: z.array(z.string()).min(2),
  effective_date: z.string(),
  term: z.string(),
});

// Convert Zod schemas to JSON Schema (and remove $schema)
const cleanSchema = (schema: any) => {
  const { $schema, ...rest } = schema;
  return rest;
};

const invoiceDataSchema = cleanSchema(zodToJsonSchema(invoiceSchema));
const contractDataSchema = cleanSchema(zodToJsonSchema(contractSchema));

async function main() {
  const runId = fs.readFileSync('/logs/artifacts/run-id', 'utf-8').trim();
  console.log(`Using run ID: ${runId}`);

  const apiKey = process.env.LLAMA_CLOUD_API_KEY;
  if (!apiKey) {
    throw new Error('LLAMA_CLOUD_API_KEY environment variable is not set');
  }

  const client = new LlamaCloud({ apiKey });

  const filesToUpload = [
    'acme_invoice.pdf',
    'globex_invoice.pdf',
    'services_contract.pdf',
    'nda_contract.pdf',
  ];

  const uploadedFiles: { basename: string; id: string; external_file_id: string }[] = [];

  for (const filename of filesToUpload) {
    const filePath = path.join(INPUT_DIR, filename);
    const basenameWithoutExt = path.basename(filename, '.pdf');
    const externalFileId = `${runId}-${basenameWithoutExt}`;

    console.log(`Uploading ${filename} with external_file_id ${externalFileId}...`);
    const fileStream = fs.createReadStream(filePath);

    const fileObj = await client.files.create({
      file: fileStream,
      purpose: 'classify',
      external_file_id: externalFileId,
    });

    console.log(`Uploaded ${filename} as file ID: ${fileObj.id}`);
    uploadedFiles.push({
      basename: filename,
      id: fileObj.id,
      external_file_id: externalFileId,
    });
  }

  const fileIds = uploadedFiles.map((f) => f.id);
  const rules = [
    {
      type: 'invoice',
      description: 'commercial invoice with an invoice number, line items, and a grand total',
    },
    {
      type: 'contract',
      description: 'legal agreement signed by two or more parties with an effective date and term',
    },
  ];

  console.log('Running single Classify job...');
  const classifyResults = await client.classifier.classify({
    file_ids: fileIds,
    rules: rules,
    mode: 'FAST',
  });

  const classificationMap = new Map<string, { category: string; confidence: number }>();

  for (const item of classifyResults.items) {
    if (!item.file_id) continue;
    const category = item.result?.type;
    const confidence = item.result?.confidence;

    if (!category || confidence === undefined) {
      throw new Error(`Failed to classify file with ID ${item.file_id}: type or confidence is missing`);
    }

    classificationMap.set(item.file_id, {
      category,
      confidence,
    });
  }

  const finalResults: Record<
    string,
    {
      category: string;
      confidence: number;
      file_id: string;
      data: any;
    }
  > = {};

  const logLines: string[] = [];

  const limit = pLimit(2);

  const extractionTasks = uploadedFiles.map((file) => {
    return limit(async () => {
      const classification = classificationMap.get(file.id);
      if (!classification) {
        throw new Error(`No classification result found for file ${file.basename} (${file.id})`);
      }

      const { category, confidence } = classification;
      const schema = category === 'invoice' ? invoiceDataSchema : contractDataSchema;

      console.log(`Starting extraction for file ${file.basename} (${file.id}) with category ${category}...`);
      
      try {
        const job = await client.extract.run({
          file_input: file.id,
          configuration: {
            data_schema: schema as any,
            extraction_target: 'per_doc',
            tier: 'agentic',
          },
        });

        console.log(`Extraction job completed for file ${file.basename} with status ${job.status}`);
        if (job.status !== 'COMPLETED') {
          throw new Error(
            `Extraction job ${job.id} for file ${file.basename} failed with status: ${job.status}. Error: ${job.error_message}`
          );
        }

        const data = job.extract_result;

        finalResults[file.basename] = {
          category,
          confidence,
          file_id: file.id,
          data: data || {},
        };

        const numFields = data ? Object.keys(data).length : 0;
        logLines.push(
          `Routed: ${file.basename} | category: ${category} | confidence: ${confidence} | fields: ${numFields}`
        );
      } catch (err) {
        console.error(`Error during extraction of ${file.basename}:`, err);
        throw err;
      }
    });
  });

  await Promise.all(extractionTasks);

  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'results.json'),
    JSON.stringify(finalResults, null, 2),
    'utf-8'
  );
  console.log('Wrote results.json successfully.');

  const logContent = logLines.join('\n') + '\n';
  fs.writeFileSync(LOG_FILE, logContent, 'utf-8');
  console.log(`Wrote output.log:\n${logContent}`);
}

main().catch((err) => {
  console.error('An error occurred:', err);
  process.exit(1);
});
