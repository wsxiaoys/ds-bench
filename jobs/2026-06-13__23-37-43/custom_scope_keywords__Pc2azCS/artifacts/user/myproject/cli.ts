import { Order } from "./src/keywords.ts";

async function main(): Promise<void> {
  // Read all of stdin
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk as Buffer);
  }
  const raw = Buffer.concat(chunks).toString("utf-8");

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log(`INVALID: ${msg}`);
    process.exit(0);
  }

  try {
    const result = Order.assert(parsed);
    console.log("VALID");
    console.log(JSON.stringify(result));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log(`INVALID: ${msg}`);
  }

  process.exit(0);
}

main().catch((err) => {
  const msg = err instanceof Error ? err.message : String(err);
  console.log(`INVALID: ${msg}`);
  process.exit(0);
});
