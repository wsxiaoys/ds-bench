import { LlamaCloud } from '@llamaindex/llama-cloud';
import fs from 'fs';
import path from 'path';

async function main() {
  const client = new LlamaCloud();
  
  const inputFilePath = '/home/user/parse-task/sample.pdf';
  const outputDir = '/home/user/parse-task/output';
  const parsedMdPath = path.join(outputDir, 'parsed.md');
  const resultLogPath = path.join(outputDir, 'result.log');

  // Ensure output directory exists
  fs.mkdirSync(outputDir, { recursive: true });

  // 1. Upload file
  console.log('Uploading file...');
  const file = await client.files.create({
    file: fs.createReadStream(inputFilePath),
    purpose: 'parse'
  });
  console.log(`File uploaded. ID: ${file.id}`);

  // 2. Run parse job
  console.log('Running parse job...');
  const result = await client.parsing.parse({
    file_id: file.id,
    tier: 'cost_effective',
    version: 'latest',
    expand: ['markdown']
  });
  
  if (!result.job) {
    throw new Error('No job returned in the result.');
  }
  
  console.log(`Job completed. ID: ${result.job.id}, Status: ${result.job.status}`);

  // 3. Concatenate markdown pages
  const pages = result.markdown?.pages || [];
  const markdownPages = pages.map(p => {
    if ('markdown' in p) {
      return p.markdown;
    }
    return '';
  });
  const fullMarkdown = markdownPages.join('\n---\n');
  
  // Save to /home/user/parse-task/output/parsed.md
  fs.writeFileSync(parsedMdPath, fullMarkdown);
  console.log(`Saved markdown to ${parsedMdPath}`);
  
  // 4. Append log to /home/user/parse-task/output/result.log
  const logEntries = [
    `File ID: ${file.id}`,
    `Job ID: ${result.job.id}`,
    `Job Status: ${result.job.status}`,
    `Page Count: ${pages.length}`
  ].join('\n') + '\n';
  
  fs.appendFileSync(resultLogPath, logEntries);
  console.log(`Appended log to ${resultLogPath}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
