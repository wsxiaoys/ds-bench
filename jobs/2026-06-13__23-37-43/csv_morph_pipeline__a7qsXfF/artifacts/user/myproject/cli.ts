import { csvPipeline } from "./src/pipeline.js";

async function main(): Promise<void> {
  // Read all of stdin verbatim – no trimming before the ArkType pipeline
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk as Buffer);
  }
  const raw = Buffer.concat(chunks).toString("utf8");

  const result = csvPipeline(raw);

  if (result instanceof type.errors) {
    // Print a single INVALID line; exit 0 as required
    console.log(`INVALID: ${result.summary}`);
    process.exit(0);
  }

  // Serialise: Date instances become ISO strings via toISOString() in JSON.stringify
  console.log("VALID");
  console.log(JSON.stringify(result));
  process.exit(0);
}

// Import type after the pipeline import so tree-shaking is straightforward
import { type } from "arktype";

main().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  console.log(`INVALID: unexpected error – ${msg}`);
  process.exit(0);
});
