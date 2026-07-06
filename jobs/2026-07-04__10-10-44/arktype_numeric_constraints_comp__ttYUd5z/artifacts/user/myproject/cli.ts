#!/usr/bin/env node
import { validateDiscount } from "./src/validator.js";

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  return await new Promise((resolve, reject) => {
    process.stdin.on("data", (chunk: Buffer) => chunks.push(chunk));
    process.stdin.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    process.stdin.on("error", (err) => reject(err));
  });
}

async function main(): Promise<void> {
  let raw: string;
  try {
    raw = await readStdin();
  } catch (err) {
    process.stdout.write(`INVALID: failed to read stdin: ${(err as Error).message}\n`);
    process.exit(0);
    return;
  }

  const text = raw.trim();
  let payload: unknown;
  try {
    payload = JSON.parse(text);
  } catch (err) {
    process.stdout.write(`INVALID: invalid JSON: ${(err as Error).message}\n`);
    process.exit(0);
    return;
  }

  const result = validateDiscount(payload);
  if (result.success && result.data !== undefined) {
    process.stdout.write(`VALID\n${JSON.stringify(result.data)}\n`);
  } else {
    process.stdout.write(`INVALID: ${result.errors ?? "validation failed"}\n`);
  }
  process.exit(0);
}

main().catch((err) => {
  process.stdout.write(`INVALID: unexpected error: ${(err as Error).message}\n`);
  process.exit(0);
});