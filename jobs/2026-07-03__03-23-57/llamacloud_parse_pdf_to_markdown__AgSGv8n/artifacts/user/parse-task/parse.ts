import fs from 'fs';
import path from 'path';
import { LlamaCloud } from '@llamaindex/llama-cloud';

async function main() {
  try {
    const filePath = '/home/user/parse-task/sample.pdf';
    if (!fs.existsSync(filePath)) {
      console.error(`Sample PDF not found at ${filePath}`);
      process.exit(1);
    }

    console.log('Initializing LlamaCloud client...');
    const client = new LlamaCloud();

    console.log('Uploading sample.pdf to LlamaCloud...');
    const fileStream = fs.createReadStream(filePath);
    const fileResponse = await client.files.create({
      file: fileStream,
      purpose: 'parse',
    });

    const fileId = fileResponse.id;
    console.log(`File uploaded successfully. File ID: ${fileId}`);

    console.log('Starting parse job...');
    const result = await client.parsing.parse({
      file_id: fileId,
      tier: 'cost_effective',
      version: 'latest',
      expand: ['markdown'],
    });

    const jobId = result.job.id;
    const jobStatus = result.job.status;
    console.log(`Parse job finished. Job ID: ${jobId}, Status: ${jobStatus}`);

    if (jobStatus !== 'COMPLETED') {
      throw new Error(`Parse job failed with status: ${jobStatus}`);
    }

    const markdownPages = result.markdown?.pages || [];
    const pageCount = markdownPages.length;
    console.log(`Parsed ${pageCount} pages.`);

    // Extract markdown content from each page
    const pageContents = markdownPages.map((page) => {
      if ('markdown' in page) {
        return page.markdown;
      } else {
        throw new Error(`Page ${page.page_number} failed to parse: ${page.error}`);
      }
    });

    // Concatenate the markdown of every returned page, separated by a line containing exactly "---"
    const concatenatedMarkdown = pageContents.join('\n---\n');

    const outputDir = '/home/user/parse-task/output';
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const parsedMdPath = path.join(outputDir, 'parsed.md');
    fs.writeFileSync(parsedMdPath, concatenatedMarkdown, 'utf-8');
    console.log(`Saved parsed markdown to ${parsedMdPath}`);

    // Append log to result.log
    const logPath = path.join(outputDir, 'result.log');
    const logEntries = [
      `File ID: ${fileId}`,
      `Job ID: ${jobId}`,
      `Job Status: COMPLETED`,
      `Page Count: ${pageCount}`,
    ];
    
    // Append to the file (with a trailing newline for each entry)
    fs.appendFileSync(logPath, logEntries.join('\n') + '\n', 'utf-8');
    console.log(`Appended log entries to ${logPath}`);

    console.log('Success!');
    process.exit(0);
  } catch (error) {
    console.error('An error occurred during parsing:', error);
    process.exit(1);
  }
}

main();
