import fs from "node:fs";
import path from "node:path";
import LlamaCloud from "@llamaindex/llama-cloud";

const SAMPLE_PDF = "/home/user/parse-task/sample.pdf";
const OUTPUT_DIR = "/home/user/parse-task/output";
const PARSED_MD = path.join(OUTPUT_DIR, "parsed.md");
const RESULT_LOG = path.join(OUTPUT_DIR, "result.log");

async function main(): Promise<void> {
  // The SDK reads LLAMA_CLOUD_API_KEY from the environment REDACTEDmatically.
  const client = new LlamaCloud();

  // Make sure the output directory exists before writing anything.
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  // 1. Upload the sample PDF to LlamaCloud with the "parse" purpose.
  const file = await client.files.create({
    file: fs.createReadStream(SAMPLE_PDF),
    purpose: "parse",
  });

  const fileId = file.id;
  console.log(`Uploaded file. File ID: ${fileId}`);

  // 2. Run a parse job using the SDK's synchronous helper that blocks
  //    until the job reaches a terminal state (it polls internally).
  const result = await client.parsing.parse(
    {
      file_id: fileId,
      tier: "cost_effective",
      version: "latest",
      expand: ["markdown"],
    },
    { verbose: true },
  );

  const job = result.job;
  const jobId = job.id;
  const jobStatus = job.status;
  console.log(`Parse job finished. Job ID: ${jobId} Status: ${jobStatus}`);

  if (jobStatus !== "COMPLETED") {
    throw new Error(
      `Parse job did not complete successfully (status=${jobStatus}): ${job.error_message ?? "unknown error"}`,
    );
  }

  // 3. Concatenate the markdown of every returned page into a single
  //    document, separated by a line containing exactly `---` between pages.
  const pages = result.markdown?.pages ?? [];
  const markdownDocument = pages
    .filter((page) => "markdown" in page && page.success !== false)
    .map((page) => (page as { markdown: string }).markdown)
    .join("\n---\n");

  fs.writeFileSync(PARSED_MD, markdownDocument, "utf8");
  console.log(`Wrote parsed markdown to ${PARSED_MD}`);

  // 4. Append a human-readable log with the key job metadata.
  const pageCount = pages.length;
  const logLines = [
    `File ID: ${fileId}`,
    `Job ID: ${jobId}`,
    `Job Status: ${jobStatus}`,
    `Page Count: ${pageCount}`,
  ];

  fs.appendFileSync(RESULT_LOG, logLines.join("\n") + "\n", "utf8");
  console.log(`Appended log entries to ${RESULT_LOG}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});