import { LlamaCloud } from '@llamaindex/llama-cloud';
import fs from 'fs';
import path from 'path';

async function main() {
  // Create output directory if it doesn't exist
  const outputDir = path.join('/home/user/parse-task', 'output');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Initialize LlamaCloud client (reads LLAMA_CLOUD_API_KEY from environment)
  const client = new LlamaCloud();

  // Upload the PDF file
  const pdfPath = '/home/user/parse-task/sample.pdf';
  const fileStream = fs.createReadStream(pdfPath);
  const fileUpload = await client.files.create({
    file: fileStream,
    purpose: 'parse'
  });

  const fileId = fileUpload.id;
  console.log(`File uploaded with ID: ${fileId}`);

  // Parse the file with specified parameters
  const result = await client.parsing.parse({
    file_id: fileId,
    tier: 'cost_effective',
    version: 'latest',
    expand: ['markdown']
  });

  const job = result.job;
  const jobId = job.id;
  const jobStatus = job.status;
  const pages = result.markdown.pages;

  console.log(`Parse job completed with ID: ${jobId}`);
  console.log(`Job status: ${jobStatus}`);
  console.log(`Page count: ${pages.length}`);

  // Concatenate markdown pages with --- separator
  const markdownContent = pages
    .map((page: any) => page.markdown)
    .join('\n---\n');

  // Save the parsed markdown
  const outputPath = path.join(outputDir, 'parsed.md');
  fs.writeFileSync(outputPath, markdownContent);
  console.log(`Parsed markdown saved to: ${outputPath}`);

  // Create log file with required metadata
  const logPath = path.join(outputDir, 'result.log');
  const logContent = `File ID: ${fileId}
Job ID: ${jobId}
Job Status: ${jobStatus}
Page Count: ${pages.length}
`;
  fs.writeFileSync(logPath, logContent);
  console.log(`Result log saved to: ${logPath}`);

  // Exit with status 0 on success
  process.exit(0);
}

main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});