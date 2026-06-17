import fs from "fs";
import path from "path";
import { createReadStream } from "fs";
import LlamaCloud from "@llamaindex/llama-cloud";
import { z } from "zod";
import pLimit from "p-limit";

// ── Schemas ──────────────────────────────────────────────────────────────────

const invoiceSchema = z.object({
  invoice_number: z.string(),
  vendor_name: z.string(),
  total_amount: z.number(),
  line_items: z.array(
    z.object({
      description: z.string(),
      quantity: z.number(),
      unit_price: z.number(),
      total: z.number(),
    })
  ),
});

const contractSchema = z.object({
  parties: z.array(z.string()).min(2),
  effective_date: z.string(),
  term: z.string(),
});

const invoiceJSONSchema = z.toJSONSchema(invoiceSchema);
const contractJSONSchema = z.toJSONSchema(contractSchema);

// ── Helpers ───────────────────────────────────────────────────────────────────

function basenameWithoutExt(filename: string): string {
  return path.basename(filename, path.extname(filename));
}

async function pollExtract(
  client: InstanceType<typeof LlamaCloud>,
  jobId: string
): Promise<Record<string, unknown>> {
  while (true) {
    const job = await client.extract.get(jobId);
    if (job.status === "COMPLETED") {
      return (job.extract_result as Record<string, unknown>) ?? {};
    }
    if (job.status === "FAILED" || job.status === "CANCELLED") {
      throw new Error(
        `Extract job ${jobId} ended with status ${job.status}: ${job.error_message ?? ""}`
      );
    }
    await new Promise((r) => setTimeout(r, 3000));
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const runId = process.env.ZEALT_RUN_ID ?? "local";

  const client = new LlamaCloud();

  const inputDir = path.join(process.cwd(), "inputs");
  const inputFiles = [
    "acme_invoice.pdf",
    "globex_invoice.pdf",
    "services_contract.pdf",
    "nda_contract.pdf",
  ];

  // ── Phase 0: Upload all four PDFs ──────────────────────────────────────────
  console.log("Uploading files…");

  const uploadedFiles: Array<{ basename: string; fileId: string }> =
    await Promise.all(
      inputFiles.map(async (basename) => {
        const filePath = path.join(inputDir, basename);
        const externalFileId = `${runId}-${basenameWithoutExt(basename)}`;

        const uploaded = await client.files.create({
          file: createReadStream(filePath) as unknown as File,
          purpose: "classify",
          external_file_id: externalFileId,
        });

        console.log(`  Uploaded ${basename} → ${uploaded.id}`);
        return { basename, fileId: uploaded.id };
      })
    );

  const fileIdMap = new Map(uploadedFiles.map((f) => [f.fileId, f.basename]));
  const basenameToFileId = new Map(
    uploadedFiles.map((f) => [f.basename, f.fileId])
  );

  // ── Phase 1: Classify ──────────────────────────────────────────────────────
  console.log("\nRunning Classify job over all four files…");

  const classifyResults = await client.classifier.classify({
    file_ids: uploadedFiles.map((f) => f.fileId),
    rules: [
      {
        type: "invoice",
        description:
          "A commercial invoice that contains an invoice number, line items, and a grand total amount payable to a vendor.",
      },
      {
        type: "contract",
        description:
          "A legal agreement or contract signed by two or more parties with an effective date and a defined term or duration.",
      },
    ],
    mode: "FAST",
  });

  // Index by file_id (order not guaranteed)
  const classifyByFileId = new Map<
    string,
    { type: string; confidence: number }
  >();
  for (const item of classifyResults.items) {
    if (!item.file_id || !item.result) continue;
    classifyByFileId.set(item.file_id, {
      type: item.result.type ?? "unknown",
      confidence: item.result.confidence,
    });
  }

  for (const { basename, fileId } of uploadedFiles) {
    const r = classifyByFileId.get(fileId);
    console.log(
      `  ${basename}: ${r?.type ?? "???"} (confidence=${r?.confidence ?? "??"})`
    );
  }

  // ── Phase 2: Extract (concurrent, max 2 in flight) ─────────────────────────
  console.log("\nRunning Extract jobs (concurrency ≤ 2)…");

  const limit = pLimit(2);

  const extractTasks = uploadedFiles.map(({ basename, fileId }) =>
    limit(async () => {
      const classifyResult = classifyByFileId.get(fileId);
      if (!classifyResult) {
        throw new Error(`No classify result for file ${fileId} (${basename})`);
      }

      const category = classifyResult.type;
      const dataSchema =
        category === "invoice" ? invoiceJSONSchema : contractJSONSchema;

      // Remove $schema key — some APIs reject it
      const { $schema: _unused, ...schemaBody } = dataSchema as Record<
        string,
        unknown
      >;

      console.log(`  Starting extract for ${basename} (category=${category})`);

      const job = await client.extract.create({
        file_input: fileId,
        configuration: {
          data_schema: schemaBody as Record<string, Record<string, unknown>>,
          extraction_target: "per_doc",
          tier: "agentic",
        },
      });

      const data = await pollExtract(client, job.id);
      console.log(`  Completed extract for ${basename}`);

      return { basename, fileId, category, confidence: classifyResult.confidence, data };
    })
  );

  const extractedResults = await Promise.all(extractTasks);

  // ── Write artifacts ────────────────────────────────────────────────────────
  const outputsDir = path.join(process.cwd(), "outputs");
  fs.mkdirSync(outputsDir, { recursive: true });

  // results.json
  const resultsJson: Record<
    string,
    {
      category: string;
      confidence: number;
      file_id: string;
      data: Record<string, unknown>;
    }
  > = {};

  const logLines: string[] = [];

  for (const { basename, fileId, category, confidence, data } of extractedResults) {
    resultsJson[basename] = { category, confidence, file_id: fileId, data };

    const fieldCount = Object.keys(data).length;
    logLines.push(
      `Routed: ${basename} | category: ${category} | confidence: ${confidence} | fields: ${fieldCount}`
    );
  }

  fs.writeFileSync(
    path.join(outputsDir, "results.json"),
    JSON.stringify(resultsJson, null, 2)
  );
  console.log("\nWrote outputs/results.json");

  fs.writeFileSync(
    path.join(process.cwd(), "output.log"),
    logLines.join("\n") + "\n"
  );
  console.log("Wrote output.log");

  console.log("\nDone ✓");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
