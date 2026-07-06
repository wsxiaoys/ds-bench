import fs from "node:fs";
import path from "node:path";
import LlamaCloud from "@llamaindex/llama-cloud";

const SAMPLES_DIR = path.join(import.meta.dirname, "samples");
const OUTPUT_LOG = path.join(import.meta.dirname, "output.log");
const RUN_ID_FILE = "/logs/artifacts/run-id";

const SAMPLE_FILES = ["invoice.txt", "receipt.txt", "contract.txt"];

const RULES = [
  {
    type: "invoice",
    description:
      "A commercial invoice issued by a seller to a buyer, containing an invoice number, bill-to section, line items with quantities and prices, and totals (subtotal, tax, amount due).",
  },
  {
    type: "receipt",
    description:
      "A point-of-sale receipt from a retail or service transaction, showing a merchant name, date, list of purchased items with prices, and a total amount paid, usually short and formatted for printing.",
  },
  {
    type: "contract",
    description:
      "A legal services agreement or contract between two parties, containing titled sections/clauses, governing terms, signatures, and formal legal language describing obligations and consideration.",
  },
];

async function main() {
  // 1. Read the parallel-run id so concurrent runs don't clobber each other.
  const runId = fs.readFileSync(RUN_ID_FILE, "utf8").trim();

  // Instantiate the client with no args; it picks up LLAMA_CLOUD_API_KEY from env.
  const client = new LlamaCloud();

  // 2. Upload each sample file with purpose="classify".
  const filePaths = SAMPLE_FILES.map((name) => path.join(SAMPLES_DIR, name));
  const uploadResponses = await Promise.all(
    filePaths.map((filePath) =>
      client.files.create({
        file: fs.createReadStream(filePath),
        purpose: "classify",
      }),
    ),
  );
  const fileIds = uploadResponses.map((r) => r.id);

  // 3. Submit a single Classify job over all files in FAST mode using the
  //    convenience helper client.classifier.classify({...}) which handles
  //    create -> poll -> results.
  const results = await client.classifier.classify({
    file_ids: fileIds,
    rules: RULES,
    mode: "FAST",
  });

  // 4. Build the log output. The order of `items` follows the order of file_ids.
  const lines: string[] = [];
  lines.push(`Run ID: ${runId}`);

  for (const item of results.items) {
    const idx = fileIds.indexOf(item.file_id ?? "");
    const basename = idx >= 0 ? SAMPLE_FILES[idx] : "unknown";
    const type = item.result?.type ?? "unknown";
    const confidence =
      item.result?.confidence !== undefined && item.result?.confidence !== null
        ? item.result.confidence
        : "N/A";
    lines.push(
      `Classified: ${basename} | Type: ${type} | Confidence: ${confidence}`,
    );
  }

  fs.writeFileSync(OUTPUT_LOG, lines.join("\n") + "\n", "utf8");
  console.log(`Wrote ${lines.length} lines to ${OUTPUT_LOG}`);
}

main().catch((err) => {
  console.error("Classification failed:", err);
  process.exit(1);
});