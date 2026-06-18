import { validateGraph } from "./src/validator.ts";

async function main(): Promise<void> {
  // Read all input from stdin
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.from(chunk));
  }
  const input = Buffer.concat(chunks).toString("utf-8").trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(input);
  } catch {
    process.stdout.write("INVALID: input is not valid JSON\n");
    process.exit(0);
  }

  // Extract the graph from the payload
  if (parsed === null || typeof parsed !== "object") {
    process.stdout.write("INVALID: input must be a JSON object with a 'graph' key\n");
    process.exit(0);
  }

  const payload = parsed as Record<string, unknown>;
  if (!("graph" in payload)) {
    process.stdout.write("INVALID: input must have a 'graph' key\n");
    process.exit(0);
  }

  try {
    const graph = validateGraph(payload.graph);
    process.stdout.write("VALID\n");
    process.stdout.write(JSON.stringify(graph) + "\n");
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    process.stdout.write(`INVALID: ${message}\n`);
  }

  process.exit(0);
}

main();
