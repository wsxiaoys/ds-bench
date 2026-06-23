import fs from 'fs';
import path from 'path';
import { LlamaCloud } from '@llamaindex/llama-cloud';
import pLimit from 'p-limit';

// Configuration
const INPUTS_DIR = './inputs';
const OUTPUTS_DIR = './outputs';
const LOG_FILE = './output.log';
const CONCURRENCY_LIMIT = 2;
const PARSE_TIER = 'cost_effective';
const PARSE_VERSION = 'latest';
const PARSE_EXPAND = ['markdown'];

// Get environment variables
const runId = process.env.ZEALT_RUN_ID || 'default-run';
const apiKey = process.env.LLAMA_CLOUD_API_KEY;

if (!apiKey) {
  console.error('Error: LLAMA_CLOUD_API_KEY environment variable is not set');
  process.exit(1);
}

// Initialize LlamaCloud client
const client = new LlamaCloud(apiKey);

// Ensure outputs directory exists
if (!fs.existsSync(OUTPUTS_DIR)) {
  fs.mkdirSync(OUTPUTS_DIR, { recursive: true });
}

// Clear the log file
fs.writeFileSync(LOG_FILE, '');

// Get all PDF files from inputs directory
const pdfFiles = fs.readdirSync(INPUTS_DIR)
  .filter(file => file.endsWith('.pdf'))
  .sort();

console.log(`Found ${pdfFiles.length} PDF files to process`);

// Create concurrency limiter
const limit = pLimit(CONCURRENCY_LIMIT);

// Process a single PDF file
async function processPdfFile(pdfFilename: string): Promise<void> {
  const pdfPath = path.join(INPUTS_DIR, pdfFilename);
  const basename = pdfFilename.replace('.pdf', '');
  const externalFileId = `${runId}-${basename}`;

  console.log(`Processing: ${pdfFilename}`);

  try {
    // Upload the file to LlamaCloud
    const fileStream = fs.createReadStream(pdfPath);
    const uploadResult = await client.files.create({
      file: fileStream,
      purpose: 'parse',
      external_file_id: externalFileId
    });

    const fileId = uploadResult.id;
    console.log(`  Uploaded ${pdfFilename} with file_id: ${fileId}`);

    // Parse the file
    const parseResult = await client.parsing.parse({
      file_id: fileId,
      tier: PARSE_TIER,
      version: PARSE_VERSION,
      expand: PARSE_EXPAND
    });

    // Extract markdown pages
    const pages = parseResult.markdown?.pages || [];
    const pageCount = pages.length;
    const markdownContent = pages
      .map(page => page.markdown)
      .join('\n\n---\n\n');

    // Write markdown output
    const outputPath = path.join(OUTPUTS_DIR, `${basename}.md`);
    fs.writeFileSync(outputPath, markdownContent);

    // Log the result
    const logLine = `Parsed: ${pdfFilename} | pages: ${pageCount}\n`;
    fs.appendFileSync(LOG_FILE, logLine);

    console.log(`  Completed ${pdfFilename}: ${pageCount} pages`);
  } catch (error) {
    console.error(`  Error processing ${pdfFilename}:`, error);
    throw error;
  }
}

// Process all PDFs with concurrency limit
async function main(): Promise<void> {
  const tasks = pdfFiles.map(pdfFile => 
    limit(() => processPdfFile(pdfFile))
  );

  await Promise.all(tasks);

  console.log('All PDFs processed successfully!');
}

// Run the main function
main().then(() => {
  process.exit(0);
}).catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});