import { CsvPipeline } from "./src/pipeline.js";
import { type } from "arktype";

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.from(chunk as Uint8Array));
  }
  return Buffer.concat(chunks).toString("utf-8");
}

const input = await readStdin();

let result;
try {
  result = CsvPipeline(input);
} catch (e) {
  console.log(`INVALID: ${e instanceof Error ? e.message : String(e)}`);
  process.exit(0);
}

if (result instanceof type.errors) {
  console.log(`INVALID: ${result.summary}`);
} else {
  console.log("VALID");
  console.log(JSON.stringify(result));
}

process.exit(0);