import { fetchWithTimeout } from "./src/validator.ts";

async function main(): Promise<void> {
  // Read JSON from stdin
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const input = Buffer.concat(chunks).toString("utf-8").trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(input);
  } catch {
    process.stdout.write("ERR invalid JSON input\n");
    return;
  }

  // Extract params from the JSON document
  const doc = parsed as Record<string, unknown>;
  const params = doc.params;

  try {
    const result = await fetchWithTimeout(params);
    process.stdout.write(`OK ${JSON.stringify(result)}\n`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    process.stdout.write(`ERR ${message}\n`);
  }
}

main();
