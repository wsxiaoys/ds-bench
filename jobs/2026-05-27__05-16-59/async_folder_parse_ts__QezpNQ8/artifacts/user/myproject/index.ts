import fs from 'fs';
import path from 'path';
import { LlamaCloud } from '@llamaindex/llama-cloud';
import pLimit from 'p-limit';

const INPUT_DIR = path.join(process.cwd(), 'inputs');
const OUTPUT_DIR = path.join(process.cwd(), 'outputs');
const LOG_FILE = path.join(process.cwd(), 'output.log');

const runId = process.env.ZEALT_RUN_ID || 'local-run';

async function main() {
  const client = new LlamaCloud({
    token: process.env.LLAMA_CLOUD_API_KEY,
  });

  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const files = fs.readdirSync(INPUT_DIR).filter(f => f.endsWith('.pdf'));

  const limit = pLimit(2);
  const logMessages: string[] = [];

  const tasks = files.map(file => limit(async () => {
    const basename = path.parse(file).name;
    const filePath = path.join(INPUT_DIR, file);
    
    const externalFileId = `${runId}-${basename}`;

    // Upload the file
    const uploadRes = await client.files.create({
      file: fs.createReadStream(filePath),
      purpose: 'parse',
      external_file_id: externalFileId
    });

    const fileId = uploadRes.id;

    // Parse the file
    const parseRes = await client.parsing.parse({
      file_id: fileId,
      tier: 'cost_effective',
      version: 'latest',
      expand: ['markdown']
    });

    const pages = parseRes.markdown?.pages || [];
    const numPages = pages.length;

    // Concat markdown
    const mdContents = pages.map((p: any) => p.markdown).filter(Boolean);
    const finalMd = mdContents.join('\n\n---\n\n');

    const outPath = path.join(OUTPUT_DIR, `${basename}.md`);
    fs.writeFileSync(outPath, finalMd, 'utf8');

    logMessages.push(`Parsed: ${file} | pages: ${numPages}`);
  }));

  await Promise.all(tasks);

  // Write log file
  fs.writeFileSync(LOG_FILE, logMessages.join('\n') + '\n', 'utf8');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
