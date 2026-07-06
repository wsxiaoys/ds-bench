import fs from 'fs';
import path from 'path';
import pLimit from 'p-limit';
import { LlamaCloud } from '@llamaindex/llama-cloud';

async function main() {
  try {
    // 1. Read run ID
    const runIdPath = '/logs/artifacts/run-id';
    if (!fs.existsSync(runIdPath)) {
      throw new Error(`Run ID file not found at ${runIdPath}`);
    }
    const runId = fs.readFileSync(runIdPath, 'utf-8').trim();
    console.log(`Using run ID: ${runId}`);

    // 2. Initialize LlamaCloud client
    const apiKey = process.env.LLAMA_CLOUD_API_KEY;
    if (!apiKey) {
      throw new Error('LLAMA_CLOUD_API_KEY environment variable is not set');
    }
    const client = new LlamaCloud({ apiKey });

    // 3. Find all PDF files under ./inputs/
    const inputsDir = './inputs';
    if (!fs.existsSync(inputsDir)) {
      throw new Error(`Inputs directory not found at ${inputsDir}`);
    }

    const files = fs.readdirSync(inputsDir);
    const pdfFiles = files.filter(f => f.toLowerCase().endsWith('.pdf'));
    console.log(`Found PDF files: ${pdfFiles.join(', ')}`);

    if (pdfFiles.length === 0) {
      console.log('No PDF files found to process.');
      fs.writeFileSync('./output.log', '');
      process.exit(0);
    }

    // Ensure outputs directory exists
    const outputsDir = './outputs';
    fs.mkdirSync(outputsDir, { recursive: true });

    // 4. Concurrency limiter (max 2 concurrent parse jobs)
    const limit = pLimit(2);
    const summaryLines: string[] = [];

    const tasks = pdfFiles.map(pdfFile => {
      const pdfBasename = path.basename(pdfFile, path.extname(pdfFile));
      const pdfPath = path.join(inputsDir, pdfFile);
      const externalFileId = `${runId}-${pdfBasename}`;

      return limit(async () => {
        console.log(`[Start] Uploading ${pdfFile} (external_file_id: ${externalFileId})...`);
        const fileStream = fs.createReadStream(pdfPath);
        
        const uploadedFile = await client.files.create({
          file: fileStream,
          purpose: 'parse',
          external_file_id: externalFileId
        });
        console.log(`[Uploaded] ${pdfFile} -> ID: ${uploadedFile.id}`);

        console.log(`[Start] Parsing ${pdfFile} (ID: ${uploadedFile.id})...`);
        const parseResult = await client.parsing.parse({
          file_id: uploadedFile.id,
          tier: 'cost_effective',
          version: 'latest',
          expand: ['markdown']
        });

        console.log(`[Parsed] ${pdfFile} complete.`);

        // Concatenate page markdowns
        const pages = parseResult.markdown?.pages || [];
        const pageCount = pages.length;
        const pageMarkdowns = pages.map(page => {
          if (page.success) {
            return page.markdown;
          } else {
            return `<!-- Error parsing page ${page.page_number}: ${page.error} -->`;
          }
        });

        const concatenatedMarkdown = pageMarkdowns.join('\n\n---\n\n');
        const outputPath = path.join(outputsDir, `${pdfBasename}.md`);
        fs.writeFileSync(outputPath, concatenatedMarkdown, 'utf-8');
        console.log(`[Saved] Markdown written to ${outputPath}`);

        // Record summary line
        // Format: Parsed: <pdf_basename>.pdf | pages: <N>
        const summaryLine = `Parsed: ${pdfFile} | pages: ${pageCount}`;
        summaryLines.push(summaryLine);
      });
    });

    // Wait for all tasks to complete
    await Promise.all(tasks);

    // 5. Write summary log
    fs.writeFileSync('./output.log', summaryLines.join('\n') + '\n', 'utf-8');
    console.log('All PDF parsing completed successfully.');
    process.exit(0);
  } catch (error) {
    console.error('Error during processing:', error);
    process.exit(1);
  }
}

main();
