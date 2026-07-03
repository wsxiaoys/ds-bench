import { readFileSync } from "node:fs";
import { validateDirectoryTree } from "./src/validator.js";

/**
 * Read the entire stdin synchronously and parse it as JSON.
 * Throws if the payload is not valid JSON.
 */
function readStdinJson(): unknown {
  const raw = readFileSync(0, "utf8");
  if (raw.trim().length === 0) {
    throw new Error("empty stdin payload");
  }
  return JSON.parse(raw);
}

function main(): void {
  let parsed: unknown;
  try {
    parsed = readStdinJson();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    process.stdout.write(`INVALID: ${message}\n`);
    return;
  }

  try {
    const validated = validateDirectoryTree(parsed);
    process.stdout.write("VALID\n");
    process.stdout.write(`${JSON.stringify(validated)}\n`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    process.stdout.write(`INVALID: ${message}\n`);
  }
}

main();