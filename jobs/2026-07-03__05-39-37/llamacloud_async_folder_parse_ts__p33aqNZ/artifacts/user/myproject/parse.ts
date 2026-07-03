import fs from "node:fs";
import path from "node:path";
import pLimit from "p-limit";
import LlamaCloud from "@llamaindex/llama-cloud";

const INPUT_DIR = path.resolve("./inputs");
const OUTPUT_DIR = path.resolve("./outputs");
const LOG_PATH = path.resolve("./output.log");
const RUN_ID_PATH = "/logs/artifacts/run-id";

const CONCURRENCY = 2;

async function main() {
  // Read the run id used to namespace uploads so concurrent test runs don't collide.
  const runId = fs.readFileSync(RUN_ID_PATH, "utf8").trim();

  // Ensure the outputs directory exists before we try to write into it.
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  // Discover every PDF under ./inputs/.
  const pdfFiles = fs
    .readdirSync(INPUT_DIR)
    .filter((name) => name.toLowerCase().endsWith(".pdf"))
    .sort();

  if (pdfFiles.length === 0) {
    console.error("No PDF files found in ./inputs/");
    process.exit(1);
  }

  const client = new LlamaCloud();

  // Cap concurrency: no more than 2 parse jobs in flight at once.
  const limit = pLimit(CONCURRENCY);

  const logLines: string[] = [];

  const tasks = pdfFiles.map((fileName) =>
    limit(() => processPdf(client, runId, fileName)),
  );

  const results = await Promise.all(tasks);

  for (const result of results) {
    logLines.push(`Parsed: ${result.basename}.pdf | pages: ${result.pageCount}`);
  }

  // Write the human-readable log (one summary line per processed PDF).
  fs.writeFileSync(LOG_PATH, logLines.join("\n") + "\n", "utf8");

  console.log(`Done. Parsed ${results.length} PDF(s). Log written to ${LOG_PATH}.`);
}

interface PdfResult {
  basename: string;
  pageCount: number;
}

async function processPdf(
  client: LlamaCloud,
  runId: string,
  fileName: string,
): Promise<PdfResult> {
  const filePath = path.join(INPUT_DIR, fileName);
  const basename = path.basename(fileName, path.extname(fileName));
  const externalFileId = `${runId}-${basename}`;

  console.log(`[${basename}] uploading...`);
  const file = await client.files.create({
    file: fs.createReadStream(filePath),
    purpose: "parse",
    external_file_id: externalFileId,
  });

  console.log(`[${basename}] parsing (file_id=${file.id})...`);
  const result = await client.parsing.parse({
    file_id: file.id,
    tier: "cost_effective",
    version: "latest",
    expand: ["markdown"],
  });

  const pages = result.markdown?.pages ?? [];
  const pageCount = pages.length;

  // Concatenate the markdown of every page, joined by the separator.
  const pageMarkdowns = pages.map((page) => {
    if ("markdown" in page && typeof page.markdown === "string") {
      return page.markdown;
    }
    // FailedMarkdownPage carries an error instead of markdown content.
    const failed = page as { error?: string; page_number?: number };
    return `<!-- page ${failed.page_number ?? "?"} failed: ${failed.error ?? "unknown error"} -->`;
  });
  const concatenated = pageMarkdowns.join("\n\n---\n\n");

  const outPath = path.join(OUTPUT_DIR, `${basename}.md`);
  fs.writeFileSync(outPath, concatenated, "utf8");
  console.log(`[${basename}] wrote ${outPath} (${pageCount} pages)`);

  return { basename, pageCount };
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});