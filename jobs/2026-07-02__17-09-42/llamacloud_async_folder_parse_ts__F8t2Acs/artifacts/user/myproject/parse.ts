import { createReadStream } from "node:fs";
import { mkdirSync, readdirSync, writeFileSync, readFileSync } from "node:fs";
import { basename, extname, join, resolve } from "node:path";
import LlamaCloud from "@llamaindex/llama-cloud";
import pLimit from "p-limit";

const RUN_ID_FILE = "/logs/artifacts/run-id";
const INPUT_DIR = resolve("./inputs");
const OUTPUT_DIR = resolve("./outputs");
const LOG_FILE = resolve("./output.log");
const MAX_CONCURRENCY = 2;

const runId = readFileSync(RUN_ID_FILE, "utf8").trim();

const client = new LlamaCloud({
  apiKey: process.env.LLAMA_CLOUD_API_KEY,
});

interface PageSummary {
  page_number: number;
  markdown: string;
}

async function parseOnePdf(filename: string): Promise<string> {
  const inputPath = join(INPUT_DIR, filename);
  const ext = extname(filename);
  const stem = basename(filename, ext);
  const externalFileId = `${runId}-${stem}`;

  // Upload the PDF with a run-scoped external_file_id so concurrent runs do not collide.
  const uploaded = await client.files.create({
    file: createReadStream(inputPath),
    purpose: "parse",
    external_file_id: externalFileId,
  });

  // Run the parse job and wait until it completes. The SDK polls internally.
  const result = await client.parsing.parse({
    file_id: uploaded.id,
    tier: "cost_effective",
    version: "latest",
    expand: ["markdown"],
  });

  const pages = result.markdown?.pages ?? [];
  const successfulPages = pages.filter(
    (p): p is PageSummary => "markdown" in p && (p as { success?: boolean }).success !== false,
  );

  const combined = successfulPages.map((p) => p.markdown).join("\n\n---\n\n");
  const outputPath = join(OUTPUT_DIR, `${stem}.md`);
  writeFileSync(outputPath, combined);

  return `Parsed: ${filename} | pages: ${pages.length}`;
}

async function main(): Promise<void> {
  mkdirSync(OUTPUT_DIR, { recursive: true });

  const pdfFiles = readdirSync(INPUT_DIR)
    .filter((name) => name.toLowerCase().endsWith(".pdf"))
    .sort();

  if (pdfFiles.length === 0) {
    writeFileSync(LOG_FILE, "");
    console.log("No PDF files found in ./inputs/");
    return;
  }

  const limit = pLimit(MAX_CONCURRENCY);

  const tasks = pdfFiles.map((filename) => limit(() => parseOnePdf(filename)));
  const logLines = await Promise.all(tasks);

  const logContents = logLines.join("\n") + "\n";
  writeFileSync(LOG_FILE, logContents);

  for (const line of logLines) {
    console.log(line);
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});