import LlamaCloud from "@llamaindex/llama-cloud";
import { toFile } from "@llamaindex/llama-cloud";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const client = new LlamaCloud();

  const runId = process.env.ZEALT_RUN_ID ?? "";

  // Sample files to classify
  const sampleFiles = [
    path.join("samples", "invoice.txt"),
    path.join("samples", "receipt.txt"),
    path.join("samples", "contract.txt"),
  ];

  // Upload each file with purpose="classify"
  console.log("Uploading files...");
  const fileIds: string[] = [];
  const fileNames: string[] = [];

  for (const filePath of sampleFiles) {
    const fileName = path.basename(filePath);
    const fileStream = fs.createReadStream(filePath);
    const uploadable = await toFile(fileStream, fileName, {
      type: "text/plain",
    });

    const uploaded = await client.files.create({
      file: uploadable,
      purpose: "classify",
    });

    console.log(`Uploaded ${fileName} with id: ${uploaded.id}`);
    fileIds.push(uploaded.id);
    fileNames.push(fileName);
  }

  // Submit a single Classify job with custom rules in FAST mode
  console.log("Submitting classify job...");
  const results = await client.classifier.classify({
    file_ids: fileIds,
    rules: [
      {
        type: "invoice",
        description:
          "A commercial invoice document that contains invoice number, billing information, line items with costs, subtotals, taxes, and total amount due from a seller to a buyer.",
      },
      {
        type: "receipt",
        description:
          "A point-of-sale receipt or transaction receipt showing items purchased, prices, payment method, and total paid at a retail location or service.",
      },
      {
        type: "contract",
        description:
          "A legal contract or services agreement containing terms and conditions, parties involved, obligations, signatures, and legally binding clauses.",
      },
    ],
    mode: "FAST",
  });

  console.log("Classification complete. Writing results...");

  // Build the log output
  const logLines: string[] = [];
  logLines.push(`Run ID: ${runId}`);

  for (const item of results.items) {
    // Match item to filename by file_id order
    const idx = fileIds.indexOf(item.file_id ?? "");
    const fileName = idx >= 0 ? fileNames[idx] : item.file_id ?? "unknown";
    const type = item.result?.type ?? "unknown";
    const confidence = item.result?.confidence ?? 0;
    logLines.push(
      `Classified: ${fileName} | Type: ${type} | Confidence: ${confidence}`
    );
  }

  const logContent = logLines.join("\n") + "\n";
  fs.writeFileSync("output.log", logContent, "utf-8");

  console.log("Done! Results written to output.log");
  console.log(logContent);
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
