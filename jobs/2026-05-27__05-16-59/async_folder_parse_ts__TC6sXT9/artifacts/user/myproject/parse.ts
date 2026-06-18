import fs from "fs";
import path from "path";
import { LlamaCloud, toFile } from "@llamaindex/llama-cloud";
import pLimit from "p-limit";

const INPUTS_DIR = "./inputs";
const OUTPUTS_DIR = "./outputs";
const LOG_FILE = "./output.log";
const CONCURRENCY = 2;

async function main() {
  // Ensure outputs directory exists
  fs.mkdirSync(OUTPUTS_DIR, { recursive: true });

  const runId = process.env.ZEALT_RUN_ID ?? "default-run";

  const client = new LlamaCloud({
    apiKey: process.env.LLAMA_CLOUD_API_KEY,
  });

  // Collect all PDF files from the inputs directory
  const pdfFiles = fs
    .readdirSync(INPUTS_DIR)
    .filter((f) => f.toLowerCase().endsWith(".pdf"));

  if (pdfFiles.length === 0) {
    console.error("No PDF files found in", INPUTS_DIR);
    process.exit(1);
  }

  console.log(`Found ${pdfFiles.length} PDF(s): ${pdfFiles.join(", ")}`);

  const limit = pLimit(CONCURRENCY);
  const logLines: string[] = [];

  // Process files with concurrency cap
  await Promise.all(
    pdfFiles.map((filename) =>
      limit(async () => {
        const basename = path.basename(filename, ".pdf");
        const filePath = path.join(INPUTS_DIR, filename);
        const externalFileId = `${runId}-${basename}`;

        console.log(`[${basename}] Uploading...`);

        // Upload the file
        const fileStream = fs.createReadStream(filePath);
        const uploadedFile = await client.files.create({
          file: await toFile(fileStream, filename, { type: "application/pdf" }),
          purpose: "parse",
          external_file_id: externalFileId,
        });

        console.log(
          `[${basename}] Uploaded (file_id=${uploadedFile.id}). Parsing...`
        );

        // Parse the uploaded file
        const result = await client.parsing.parse({
          file_id: uploadedFile.id,
          tier: "cost_effective",
          version: "latest",
          expand: ["markdown"],
        });

        const pages = result.markdown?.pages ?? [];
        const pageCount = pages.length;

        // Concatenate page markdown
        const combinedMarkdown = pages.map((p) => p.markdown).join("\n\n---\n\n");

        // Write output markdown file
        const outputPath = path.join(OUTPUTS_DIR, `${basename}.md`);
        fs.writeFileSync(outputPath, combinedMarkdown, "utf-8");

        const logLine = `Parsed: ${basename}.pdf | pages: ${pageCount}`;
        logLines.push(logLine);
        console.log(`[${basename}] Done — ${logLine}`);
      })
    )
  );

  // Write log file
  fs.writeFileSync(LOG_FILE, logLines.join("\n") + "\n", "utf-8");
  console.log(`\nAll done. Log written to ${LOG_FILE}`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
