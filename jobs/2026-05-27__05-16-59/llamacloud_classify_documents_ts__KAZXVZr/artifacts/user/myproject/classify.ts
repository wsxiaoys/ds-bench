import fs from "fs";
import path from "path";
import LlamaCloud from "@llamaindex/llama-cloud";

const SAMPLE_FILES = [
  path.join("samples", "invoice.txt"),
  path.join("samples", "receipt.txt"),
  path.join("samples", "contract.txt"),
];

const RULES = [
  {
    type: "invoice",
    description:
      "Formal commercial invoice with an invoice number, bill-to section, line items, subtotal, tax, and total due.",
  },
  {
    type: "receipt",
    description:
      "Short point-of-sale receipt with store name, itemized prices, subtotal/tax, total, and payment method (often ends with thank you).",
  },
  {
    type: "contract",
    description:
      "Multi-paragraph legal services agreement between parties describing terms, scope, and signature lines for both parties.",
  },
];

const RUN_ID = process.env.ZEALT_RUN_ID;

if (!RUN_ID) {
  throw new Error("ZEALT_RUN_ID environment variable is required.");
}

const client = new LlamaCloud();

const uploadFiles = async () => {
  const uploads = await Promise.all(
    SAMPLE_FILES.map(async (filePath) => {
      const file = fs.createReadStream(filePath);
      const created = await client.files.create({ file, purpose: "classify" });
      return { filePath, fileId: created.id };
    })
  );

  return uploads;
};

const run = async () => {
  const uploads = await uploadFiles();
  const fileIds = uploads.map((upload) => upload.fileId);

  const classification = await client.classifier.classify({
    file_ids: fileIds,
    rules: RULES,
    mode: "FAST",
  });

  const lines = [`Run ID: ${RUN_ID}`];
  const resultsById = new Map(
    classification.items.map((item) => [item.file_id, item.result])
  );

  SAMPLE_FILES.forEach((filePath) => {
    const upload = uploads.find((entry) => entry.filePath === filePath);

    if (!upload) {
      throw new Error(`Missing upload for ${filePath}`);
    }

    const result = resultsById.get(upload.fileId);

    if (!result) {
      throw new Error(`Missing classification result for ${filePath}`);
    }

    const basename = path.basename(filePath);
    lines.push(
      `Classified: ${basename} | Type: ${result.type} | Confidence: ${result.confidence}`
    );
  });

  fs.writeFileSync(path.join("output.log"), lines.join("\n"));
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
