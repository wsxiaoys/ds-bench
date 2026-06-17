import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import pLimit from 'p-limit';
import { LlamaCloud } from '@llamaindex/llama-cloud';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Define the Invoice schema using Zod
const InvoiceSchema = z.object({
  vendor_name: z.string(),
  invoice_number: z.string(),
  total_amount: z.number(),
  currency: z.string().length(3),
});

// Convert Zod schema to JSON Schema
const dataSchema = InvoiceSchema.toJSONSchema();

// Initialize LlamaCloud client
const client = new LlamaCloud({
  apiKey: process.env.LLAMA_CLOUD_API_KEY,
});

// Configuration
const INVOICES_DIR = path.join(__dirname, 'invoices');
const RESULTS_PATH = path.join(__dirname, 'results.json');
const LOG_PATH = path.join(__dirname, 'output.log');
const CONCURRENT_LIMIT = 3;
const JOB_TIMEOUT_MS = 240000; // 240 seconds

// Discover all PDF files (case-insensitive)
function discoverPDFFiles(dir: string): string[] {
  const files: string[] = [];
  
  function walk(currentDir: string) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.pdf')) {
        files.push(fullPath);
      }
    }
  }
  
  walk(dir);
  return files;
}

// Logger that writes to both file and stdout
class Logger {
  private logStream: fs.WriteStream;

  constructor(logPath: string) {
    this.logStream = fs.createWriteStream(logPath, { flags: 'w' });
  }

  log(message: string): void {
    const timestamp = new Date().toISOString();
    const logLine = message;
    this.logStream.write(logLine + '\n');
    console.log(logLine);
  }

  close(): void {
    this.logStream.end();
  }
}

// Poll a job until it reaches terminal status or timeout
async function pollJob(
  jobId: string,
  timeoutMs: number
): Promise<{ status: string; result?: any; error?: string }> {
  const startTime = Date.now();
  const pollInterval = 2000; // Poll every 2 seconds

  while (Date.now() - startTime < timeoutMs) {
    try {
      const job = await client.extract.get(jobId);
      
      if (job.status === 'COMPLETED') {
        return { status: 'COMPLETED', result: job.extract_result };
      } else if (job.status === 'FAILED' || job.status === 'CANCELLED') {
        return { status: job.status, error: `Job ${job.status.toLowerCase()}` };
      }
      
      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return { status: 'ERROR', error: errorMessage };
    }
  }

  return { status: 'TIMEOUT', error: 'Job timeout after 240 seconds' };
}

// Process a single PDF file
async function processPDF(
  filePath: string,
  logger: Logger
): Promise<{ file: string; status: 'success' | 'error'; data?: any; error?: string }> {
  const fileName = path.basename(filePath);
  
  try {
    logger.log(`Processing ${fileName}...`);
    
    // Upload file to LlamaCloud
    const fileStream = fs.createReadStream(filePath);
    const uploadedFile = await client.files.create({
      file: fileStream,
      purpose: 'extract',
    });
    
    const fileId = uploadedFile.id;
    logger.log(`Uploaded ${fileName} as ${fileId}`);
    
    // Create extract job
    const job = await client.extract.create({
      file_input: fileId,
      configuration: {
        data_schema: dataSchema,
        extraction_target: 'per_doc',
        tier: 'cost_effective',
      },
    });
    
    logger.log(`Created extraction job ${job.id} for ${fileName}`);
    
    // Poll job until completion or timeout
    const jobResult = await pollJob(job.id, JOB_TIMEOUT_MS);
    
    if (jobResult.status === 'COMPLETED' && jobResult.result) {
      logger.log(`PROCESSED ${fileName}: success`);
      return {
        file: fileName,
        status: 'success',
        data: jobResult.result,
      };
    } else {
      const errorMessage = jobResult.error || 'Unknown error';
      logger.log(`PROCESSED ${fileName}: error - ${errorMessage}`);
      return {
        file: fileName,
        status: 'error',
        error: errorMessage,
      };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.log(`PROCESSED ${fileName}: error - ${errorMessage}`);
    return {
      file: fileName,
      status: 'error',
      error: errorMessage,
    };
  }
}

// Main function
async function main() {
  const logger = new Logger(LOG_PATH);
  
  try {
    logger.log('Starting batch invoice extraction pipeline...');
    
    // Discover all PDF files
    const pdfFiles = discoverPDFFiles(INVOICES_DIR);
    logger.log(`Found ${pdfFiles.length} PDF files to process`);
    
    // Process files with bounded concurrency
    const limit = pLimit(CONCURRENT_LIMIT);
    const processingPromises = pdfFiles.map(filePath => 
      limit(() => processPDF(filePath, logger))
    );
    
    const results = await Promise.all(processingPromises);
    
    // Calculate summary
    const total = results.length;
    const success = results.filter(r => r.status === 'success').length;
    const failed = results.filter(r => r.status === 'error').length;
    
    // Write results.json
    fs.writeFileSync(RESULTS_PATH, JSON.stringify(results, null, 2));
    logger.log(`Results written to ${RESULTS_PATH}`);
    
    // Write summary to log and stdout
    const summaryLine = `SUMMARY total=${total} success=${success} failed=${failed}`;
    logger.log(summaryLine);
    
    logger.close();
    process.exit(0);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.log(`Fatal error: ${errorMessage}`);
    logger.close();
    process.exit(1);
  }
}

main();