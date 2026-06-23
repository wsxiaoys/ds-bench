import { LlamaCloud } from "@llamaindex/llama-cloud";
import fs from "fs";
import path from "path";

async function main() {
  const client = new LlamaCloud();
  const filePath = "/home/user/parse-task/sample.pdf";
  const outputDir = "/home/user/parse-task/output";
  const markdownFile = path.join(outputDir, "parsed.md");
  const logFile = path.join(outputDir, "result.log");

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  try {
    console.log("Uploading file...");
    const file = await client.files.create({
      file: fs.createReadStream(filePath),
      purpose: "parse",
    });
    console.log(`File uploaded. ID: ${file.id}`);

    console.log("Starting parse job...");
    const result = await client.parsing.parse({
      file_id: file.id,
      tier: "cost_effective",
      version: "latest",
      expand: ["markdown"],
    });

    if (result.job.status !== "COMPLETED") {
      throw new Error(`Job failed with status: ${result.job.status}`);
    }

    console.log(`Job completed. ID: ${result.job.id}`);

    const pages = result.markdown?.pages || [];
    const markdownContent = pages
      .sort((a, b) => a.page_number - b.page_number)
      .map((page) => page.markdown)
      .join("\n---\n");

    fs.writeFileSync(markdownFile, markdownContent);
    console.log(`Markdown saved to ${markdownFile}`);

    const logEntries = [
      `File ID: ${file.id}`,
      `Job ID: ${result.job.id}`,
      `Job Status: ${result.job.status}`,
      `Page Count: ${pages.length}`,
    ];

    fs.writeFileSync(logFile, logEntries.join("\n") + "\n");
    console.log(`Log saved to ${logFile}`);

  } catch (error) {
    console.error("Error during parsing:", error);
    process.exit(1);
  }
}

main();
