import { fetchWithTimeout } from "./src/validator.ts";

async function main(): Promise<void> {
  // Read all of stdin
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk as Buffer);
  }
  const raw = Buffer.concat(chunks).toString("utf8");

  let params: unknown;
  try {
    const parsed = JSON.parse(raw) as { params?: unknown };
    params = parsed.params;
  } catch {
    process.stdout.write("ERR failed to parse stdin as JSON\n");
    process.exit(0);
  }

  try {
    // fetchWithTimeout validates params synchronously at the type.fn boundary;
    // any validation error is thrown before any setTimeout is scheduled.
    // We await to capture both synchronous throws and rejected promises.
    const result = await (fetchWithTimeout as (p: unknown) => Promise<unknown>)(
      params,
    );
    process.stdout.write(`OK ${JSON.stringify(result)}\n`);
  } catch (err: unknown) {
    const msg =
      err instanceof Error
        ? err.message
        : typeof err === "string"
          ? err
          : JSON.stringify(err);
    process.stdout.write(`ERR ${msg}\n`);
  }
}

main();
