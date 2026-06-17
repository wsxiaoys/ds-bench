import fs from "node:fs";
import path from "node:path";
import { promises as fsp } from "node:fs";
import pLimit from "p-limit";
import { LlamaCloud } from "@llamaindex/llama-cloud";

const INPUT_DIR = path.resolve("inputs");
const OUTPUT_DIR = path.resolve("outputs");
const LOG_PATH = path.resolve("output.log");

const runId = process.env.ZEALT_RUN_ID;
if (!runId) {
  throw new Error("ZEALT_RUN_ID environment variable is required.");
}

const client = new LlamaCloud();

const isPdf = (fileName: string) => fileName.toLowerCase().endsWith(".pdf");

const walkDir = async (dir: string): Promise<string[]> => {
  const entries = await fsp.readdir(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walkDir(entryPath)));
      continue;
    }
    if (entry.isFile() && isPdf(entry.name)) {
      files.push(entryPath);
    }
  }

  return files;
};

const processPdf = async (filePath: string) => {
  const basename = path.basename(filePath, ".pdf");
  const externalFileId = `${runId}-${basename}`;

  const uploaded = await client.files.create({
    file: fs.createReadStream(filePath),
    purpose: "parse",
    external_file_id: externalFileId,
  });

  const result = await client.parsing.parse({
    file_id: uploaded.id,
    tier: "cost_effective",
    version: "latest",
    expand: ["markdown"],
  });

  const pages = result.markdown?.pages ?? [];
  const markdown = pages.map((page) => page.markdown ?? "").join("\n\n---\n\n");

  await fsp.writeFile(path.join(OUTPUT_DIR, `${basename}.md`), markdown, "utf8");

  return { basename, pageCount: pages.length };
};

const main = async () => {
  await fsp.mkdir(OUTPUT_DIR, { recursive: true });

  const pdfFiles = await walkDir(INPUT_DIR);
  if (pdfFiles.length === 0) {
    throw new Error("No PDF files found under ./inputs.");
  }

  const limit = pLimit(2);
  const results = await Promise.all(pdfFiles.map((file) => limit(() => processPdf(file))));

  const logLines = results.map(
    (result) => `Parsed: ${result.basename}.pdf | pages: ${result.pageCount}`
  );

  await fsp.writeFile(LOG_PATH, `${logLines.join("\n")}\n`, "utf8");
};

main();
