import { validateDiscount } from "./src/validator.js";

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : (chunk as Buffer));
  }
  return Buffer.concat(chunks).toString("utf8");
}

async function main(): Promise<void> {
  const raw = await readStdin();
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    console.log("INVALID: empty input");
    return;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch (err) {
    console.log(`INVALID: ${(err as Error).message}`);
    return;
  }

  const result = validateDiscount(parsed);
  if ("errors" in result) {
    console.log(`INVALID: ${result.errors}`);
    return;
  }

  console.log("VALID");
  console.log(JSON.stringify(result));
}

main().catch((err) => {
  console.log(`INVALID: ${(err as Error).message}`);
});
