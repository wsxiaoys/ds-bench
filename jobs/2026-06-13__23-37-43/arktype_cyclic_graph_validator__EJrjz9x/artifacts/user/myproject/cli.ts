import { validateGraph } from "./src/validator.js";
import { ArkErrors } from "arktype";

async function main(): Promise<void> {
  // Read all of stdin
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk as Buffer);
  }
  const raw = Buffer.concat(chunks).toString("utf8").trim();

  // Parse outer JSON wrapper
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    process.stdout.write(`INVALID: malformed JSON input\n`);
    process.exit(0);
  }

  // Extract the "graph" field
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    !("graph" in parsed)
  ) {
    process.stdout.write(`INVALID: input must be an object with a "graph" key\n`);
    process.exit(0);
  }

  const graphInput = (parsed as Record<string, unknown>)["graph"];

  // Validate
  try {
    const graph = validateGraph(graphInput);
    process.stdout.write(`VALID\n`);
    process.stdout.write(`${JSON.stringify(graph)}\n`);
  } catch (err) {
    if (err instanceof ArkErrors) {
      process.stdout.write(`INVALID: ${err.summary}\n`);
    } else if (err instanceof Error) {
      process.stdout.write(`INVALID: ${err.message}\n`);
    } else {
      process.stdout.write(`INVALID: validation failed\n`);
    }
  }

  process.exit(0);
}

main();
