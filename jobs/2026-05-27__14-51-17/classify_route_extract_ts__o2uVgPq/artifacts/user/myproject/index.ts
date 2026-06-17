import fs from 'fs';
import path from 'path';
import { LlamaCloud } from '@llamaindex/llama-cloud';
import { z } from 'zod';
import pLimit from 'p-limit';

// Configuration
const INPUT_DIR = './inputs';
const OUTPUT_DIR = './outputs';
const ZEALT_RUN_ID = process.env.ZEALT_RUN_ID || 'default-run';

// Initialize LlamaCloud client
const client = new LlamaCloud();

// Define schemas using Zod
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

// Get all PDF files from input directory
function getPdfFiles(): string[] {
  const files = fs.readdirSync(INPUT_DIR);
  return files.filter((f) => f.endsWith('.pdf')).sort();
}

// Upload a file to LlamaCloud
async function uploadFile(filePath: string): Promise<{ id: string; basename: string }> {
  const basename = path.basename(filePath);
  const basenameWithoutExt = path.basename(filePath, '.pdf');
  const externalFileId = `${ZEALT_RUN_ID}-${basenameWithoutExt}`;

  console.log(`Uploading ${basename} with external_file_id: ${externalFileId}`);

  const fileStream = fs.createReadStream(filePath);
  const fileObj = await client.files.create({
    file: fileStream,
    purpose: 'classify',
    external_file_id: externalFileId,
  });

  console.log(`Uploaded ${basename} -> file_id: ${fileObj.id}`);
  return { id: fileObj.id, basename };
}

// Phase 1: Classify all files
async function classifyFiles(fileIds: string[]): Promise<Map<string, { type: string; confidence: number }>> {
  console.log('\n=== Phase 1: Classifying files ===');

  const result = await client.classifier.classify({
    file_ids: fileIds,
    mode: 'FAST',
    rules: [
      {
        type: 'invoice',
        description: 'commercial invoice with an invoice number, line items, and a grand total',
      },
      {
        type: 'contract',
        description: 'legal agreement signed by two or more parties with an effective date and term',
      },
    ],
  });

  console.log(`Classification result: ${result.items.length} items`);

  // Build a map of file_id -> classification result
  const classificationMap = new Map<string, { type: string; confidence: number }>();
  for (const item of result.items) {
    const { file_id, result: itemResult } = item;
    classificationMap.set(file_id, {
      type: itemResult.type,
      confidence: itemResult.confidence,
    });
    console.log(`  File ${file_id}: type=${itemResult.type}, confidence=${itemResult.confidence}`);
  }

  return classificationMap;
}

// Phase 2: Extract data from files based on classification
async function extractData(
  fileId: string,
  category: string
): Promise<any> {
  console.log(`Extracting data for file ${fileId} (${category})`);

  let dataSchema: any;
  if (category === 'invoice') {
    dataSchema = invoiceSchema.toJSONSchema();
  } else if (category === 'contract') {
    dataSchema = contractSchema.toJSONSchema();
  } else {
    throw new Error(`Unknown category: ${category}`);
  }

  const job = await client.extract.create({
    file_input: fileId,
    configuration: {
      data_schema: dataSchema,
      extraction_target: 'per_doc',
      tier: 'agentic',
    },
  });

  console.log(`  Extract job created: ${job.id}`);

  // Poll for completion
  let extractJob = await client.extract.get(job.id);
  while (
    extractJob.status !== 'COMPLETED' &&
    extractJob.status !== 'FAILED' &&
    extractJob.status !== 'CANCELLED'
  ) {
    console.log(`  Waiting for job ${job.id}... status: ${extractJob.status}`);
    await new Promise((resolve) => setTimeout(resolve, 2000));
    extractJob = await client.extract.get(job.id);
  }

  if (extractJob.status === 'FAILED' || extractJob.status === 'CANCELLED') {
    throw new Error(`Extract job ${job.id} failed with status: ${extractJob.status}`);
  }

  console.log(`  Extract job ${job.id} completed`);
  return extractJob.extract_result;
}

// Main execution
async function main() {
  try {
    console.log('Starting Classify → Route → Extract pipeline');
    console.log(`ZEALT_RUN_ID: ${ZEALT_RUN_ID}`);

    // Get all PDF files
    const pdfFiles = getPdfFiles();
    console.log(`Found ${pdfFiles.length} PDF files to process`);

    // Upload all files
    console.log('\n=== Uploading files ===');
    const uploadPromises = pdfFiles.map((file) =>
      uploadFile(path.join(INPUT_DIR, file))
    );
    const uploadedFiles = await Promise.all(uploadPromises);

    // Create a map of basename -> file info
    const fileMap = new Map<string, { id: string; basename: string }>();
    for (const file of uploadedFiles) {
      fileMap.set(file.basename, file);
    }

    // Get all file IDs
    const fileIds = uploadedFiles.map((f) => f.id);

    // Phase 1: Classify all files
    const classificationMap = await classifyFiles(fileIds);

    // Phase 2: Extract data for each file based on classification
    console.log('\n=== Phase 2: Extracting data ===');

    // Build extraction tasks
    const extractTasks: Array<{
      basename: string;
      fileId: string;
      category: string;
      confidence: number;
    }> = [];

    for (const file of uploadedFiles) {
      const classification = classificationMap.get(file.id);
      if (!classification) {
        throw new Error(`No classification found for file ${file.id}`);
      }
      extractTasks.push({
        basename: file.basename,
        fileId: file.id,
        category: classification.type,
        confidence: classification.confidence,
      });
    }

    // Run extract jobs concurrently with max 2 in flight
    const limit = pLimit(2);
    const extractPromises = extractTasks.map((task) =>
      limit(async () => {
        const data = await extractData(task.fileId, task.category);
        return {
          basename: task.basename,
          fileId: task.fileId,
          category: task.category,
          confidence: task.confidence,
          data,
        };
      })
    );

    const results = await Promise.all(extractPromises);

    // Build results object keyed by basename
    const resultsMap: Record<
      string,
      {
        category: string;
        confidence: number;
        file_id: string;
        data: any;
      }
    > = {};

    for (const result of results) {
      resultsMap[result.basename] = {
        category: result.category,
        confidence: result.confidence,
        file_id: result.fileId,
        data: result.data,
      };
    }

    // Write results.json
    const resultsPath = path.join(OUTPUT_DIR, 'results.json');
    fs.writeFileSync(resultsPath, JSON.stringify(resultsMap, null, 2));
    console.log(`\nResults written to ${resultsPath}`);

    // Write output.log
    const logLines: string[] = [];
    for (const result of results) {
      const fieldCount = Object.keys(result.data).length;
      const logLine = `Routed: ${result.basename} | category: ${result.category} | confidence: ${result.confidence} | fields: ${fieldCount}`;
      logLines.push(logLine);
    }

    const logPath = path.join(OUTPUT_DIR, '../output.log');
    fs.writeFileSync(logPath, logLines.join('\n') + '\n');
    console.log(`Log written to ${logPath}`);

    console.log('\n=== Pipeline completed successfully ===');
    console.log(`Processed ${results.length} files`);
    console.log(`  - Invoices: ${results.filter((r) => r.category === 'invoice').length}`);
    console.log(`  - Contracts: ${results.filter((r) => r.category === 'contract').length}`);

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();