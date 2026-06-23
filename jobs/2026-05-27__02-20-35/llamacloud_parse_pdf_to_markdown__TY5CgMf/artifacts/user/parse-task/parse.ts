import { createReadStream } from "node:fs";
import { promises as fs } from "node:fs";
import path from "node:path";
import { LlamaCloud } from "@llamaindex/llama-cloud";

const PDF_PATH = "/home/user/parse-task/sample.pdf";
const OUTPUT_DIR = "/home/user/parse-task/output";
const OUTPUT_MD = path.join(OUTPUT_DIR, "parsed.md");
const OUTPUT_LOG = path.join(OUTPUT_DIR, "result.log");

const main = async () => {
  const client = new LlamaCloud();

  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  const upload = await client.files.create({
    file: createReadStream(PDF_PATH),
    purpose: "parse",
  });

  const parseResult = await client.parsing.parse({
    file_id: upload.id,
    tier: "cost_effective",
    version: "latest",
    expand: ["markdown"],
  });

  const jobId = parseResult.job.id;
  const jobResponse = await client.parsing.get(jobId);
  const jobStatus =
    (jobResponse as { status?: string }).status ??
    (jobResponse as { job?: { status?: string } }).job?.status ??
    parseResult.job.status;

  if (jobStatus !== "COMPLETED") {
    throw new Error(`Parse job did not complete. Status: ${jobStatus}`);
  }

  const pages = parseResult.markdown?.pages ?? [];
  const markdownContent = pages
    .map((page) => page.markdown)
    .filter((pageMarkdown) => pageMarkdown && pageMarkdown.trim().length > 0)
    .join("\n---\n");

  if (!markdownContent.trim()) {
    throw new Error("Parsed markdown is empty.");
  }

  await fs.writeFile(OUTPUT_MD, markdownContent, "utf8");

  const logLines = [
    `File ID: ${upload.id}`,
    `Job ID: ${jobId}`,
    `Job Status: ${jobStatus}`,
    `Page Count: ${pages.length}`,
  ];

  await fs.appendFile(OUTPUT_LOG, `${logLines.join("\n")}\n`, "utf8");
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
