import { validateDirectoryTree } from "./src/validator.js";

async function main(): Promise<void> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk as Buffer);
  }
  const raw = Buffer.concat(chunks).toString("utf8").trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    process.stdout.write("INVALID: input is not valid JSON\n");
    process.exit(0);
  }

  try {
    const result = validateDirectoryTree(parsed);
    process.stdout.write("VALID\n");
    process.stdout.write(JSON.stringify(result) + "\n");
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    process.stdout.write(`INVALID: ${message}\n`);
  }

  process.exit(0);
}

main();
