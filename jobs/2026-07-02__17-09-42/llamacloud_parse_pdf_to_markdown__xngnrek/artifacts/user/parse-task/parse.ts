import fs from "node:fs";
import path from "node:path";
import { LlamaCloud } from "@llamaindex/llama-cloud";

const INPUT_PDF_PATH = "/home/user/parse-task/sample.pdf";
const OUTPUT_DIR = "/home/user/parse-task/output";
const OUTPUT_MD_PATH = path.join(OUTPUT_DIR, "parsed.md");
const OUTPUT_LOG_PATH = path.join(OUTPUT_DIR, "result.log");

async function main() {
  // Ensure output directory exists
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  // Initialize client. Reads LLAMA_CLOUD_API_KEY from env REDACTEDmatically.
  const client = new LlamaCloud();

  // Upload the PDF with the parse-purpose marker
  const fileStream = fs.createReadStream(INPUT_PDF_PATH);
  const uploaded = await client.files.create({
    file: fileStream,
    purpose: "parse",
  });

  const fileId = uploaded.id;
  if (!fileId) {
    throw new Error("Failed to retrieve file id from upload response");
  }

  // Run the synchronous parse job; this awaits completion.
  const result = await client.parsing.parse({
    file_id: fileId,
    tier: "cost_effective",
    version: "latest",
    expand: ["markdown"],
  });

  // Extract job metadata
  const jobId = result.job?.id;
  const jobStatus = result.job?.status;
  if (!jobId) {
    throw new Error("Failed to retrieve job id from parse result");
  }

  // Concatenate pages, separated by `---`
  const pages = result.markdown?.pages ?? [];
  const pageCount = pages.length;
  const combinedMarkdown = pages
    .map((p) => p.markdown ?? "")
    .join("\n---\n");

  fs.writeFileSync(OUTPUT_MD_PATH, combinedMarkdown, "utf8");

  // Build/append the log
  const logLines = [
    `File ID: ${fileId}`,
    `Job ID: ${jobId}`,
    `Job Status: ${jobStatus ?? "COMPLETED"}`,
    `Page Count: ${pageCount}`,
  ];
  fs.appendFileSync(OUTPUT_LOG_PATH, logLines.join("\n") + "\n", "utf8");

  console.log(`Parsed ${pageCount} page(s). File ID: ${fileId}, Job ID: ${jobId}, Status: ${jobStatus}`);
}

main().catch((err) => {
  console.error("Parse failed:", err);
  process.exit(1);
});