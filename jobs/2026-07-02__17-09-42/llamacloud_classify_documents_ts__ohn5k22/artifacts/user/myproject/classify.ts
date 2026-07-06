import fs from "node:fs";
import path from "node:path";
import LlamaCloud from "@llamaindex/llama-cloud";

// Sample files to classify, in the order we want results to be reported.
const sampleFiles = [
  "samples/invoice.txt",
  "samples/receipt.txt",
  "samples/contract.txt",
];

// Natural-language rules for each developer-defined type.
const rules = [
  {
    type: "invoice",
    description:
      "A commercial invoice issued by a seller to a buyer. It contains an invoice number, an invoice date, a bill-to / from section, line items with quantities and unit prices, subtotal, tax, and a total amount due.",
  },
  {
    type: "receipt",
    description:
      "A point-of-sale receipt printed at the time of purchase. It shows a merchant name and address, the date and time, a short list of items purchased with individual prices, a subtotal, tax, total, and the payment method used (e.g. credit card last four digits, cash, change).",
  },
  {
    type: "contract",
    description:
      "A legal services agreement or contract between two parties. It contains recitals identifying the parties and the effective date, numbered sections describing services, term, compensation, confidentiality, and governing law, and signature blocks for both parties.",
  },
];

const outputPath = "output.log";
const runIdPath = "/logs/artifacts/run-id";

async function main() {
  // The SDK reads LLAMA_CLOUD_API_KEY from the environment by default.
  const client = new LlamaCloud();

  // Upload each sample file with purpose="classify".
  const uploaded: { basename: string; id: string }[] = [];
  for (const relativePath of sampleFiles) {
    const stream = fs.createReadStream(relativePath);
    const created = await client.files.create({
      file: stream,
      purpose: "classify",
    });
    uploaded.push({ basename: path.basename(relativePath), id: created.id });
  }

  // Run a single Classify job over all uploaded files in FAST mode.
  const results = await client.classifier.classify({
    file_ids: uploaded.map((f) => f.id),
    rules,
    mode: "FAST",
  });

  // Read the run id supplied by the parallel-run harness.
  const runId = fs.readFileSync(runIdPath, "utf8").trim();

  // items are returned in the same order as file_ids.
  const lines: string[] = [];
  lines.push(`Run ID: ${runId}`);
  for (let i = 0; i < uploaded.length; i++) {
    const { basename } = uploaded[i];
    const item = results.items[i];
    const type = item?.result?.type ?? "unknown";
    const confidence = item?.result?.confidence ?? 0;
    lines.push(`Classified: ${basename} | Type: ${type} | Confidence: ${confidence}`);
  }

  fs.writeFileSync(outputPath, lines.join("\n") + "\n", "utf8");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
