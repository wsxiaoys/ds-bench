import fs from "fs";
import path from "path";
import { LlamaCloud } from "@llamaindex/llama-cloud";

async function main() {
  // Initialize client — reads LLAMA_CLOUD_API_KEY from env automatically
  const client = new LlamaCloud();

  const PDF_PATH = "/home/user/parse-task/sample.pdf";
  const OUTPUT_DIR = "/home/user/parse-task/output";
  const PARSED_MD_PATH = path.join(OUTPUT_DIR, "parsed.md");
  const LOG_PATH = path.join(OUTPUT_DIR, "result.log");

  // Ensure output directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // 1. Upload the PDF with purpose "parse"
  console.log("Uploading PDF...");
  const uploadedFile = await client.files.create({
    file: fs.createReadStream(PDF_PATH),
    purpose: "parse",
  });
  const fileId = uploadedFile.id;
  console.log(`File uploaded. File ID: ${fileId}`);

  // 2. Parse the uploaded file using the synchronous helper
  console.log("Starting parse job...");
  const result = await client.parsing.parse(
    {
      file_id: fileId,
      tier: "cost_effective",
      version: "latest",
      expand: ["markdown"],
    },
    { verbose: true }
  );

  const jobId = result.job.id;
  const jobStatus = result.job.status;
  console.log(`Parse job completed. Job ID: ${jobId}, Status: ${jobStatus}`);

  // 3. Build the combined markdown document from all pages
  const pages = result.markdown?.pages ?? [];
  const markdownParts: string[] = [];

  for (const page of pages) {
    if ("markdown" in page) {
      markdownParts.push(page.markdown);
    }
  }

  // Join pages with a separator line
  const combinedMarkdown = markdownParts.join("\n---\n");
  fs.writeFileSync(PARSED_MD_PATH, combinedMarkdown, "utf-8");
  console.log(`Markdown written to ${PARSED_MD_PATH}`);

  // 4. Write the audit log
  const pageCount = pages.length;
  const logLines = [
    `File ID: ${fileId}`,
    `Job ID: ${jobId}`,
    `Job Status: ${jobStatus}`,
    `Page Count: ${pageCount}`,
  ];
  const logContent = logLines.join("\n") + "\n";
  fs.appendFileSync(LOG_PATH, logContent, "utf-8");
  console.log(`Log written to ${LOG_PATH}`);

  console.log("Done.");
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
