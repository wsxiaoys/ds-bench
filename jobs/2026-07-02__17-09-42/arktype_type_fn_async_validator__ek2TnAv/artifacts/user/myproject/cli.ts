import { fetchWithTimeout } from "./src/validator.js";

/**
 * Read the entire stdin contents as a UTF-8 string.
 *
 * Node's `ReadableStream` types and DOM `ReadableStream` types do not unify
 * cleanly under `lib: ["ES2022"]` + `module: NodeNext` without DOM lib, so we
 * accumulate chunks manually.
 */
async function readAllStdin(): Promise<string> {
  return await new Promise<string>((resolve, reject) => {
    const chunks: Buffer[] = [];
    process.stdin.on("data", (chunk: Buffer | string) => {
      chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
    });
    process.stdin.on("end", () => {
      resolve(Buffer.concat(chunks).toString("utf8"));
    });
    process.stdin.on("error", (err) => {
      reject(err);
    });
  });
}

function formatError(err: unknown): string {
  if (err instanceof Error && err.message) {
    return err.message;
  }
  if (typeof err === "string" && err.length > 0) {
    return err;
  }
  try {
    const s = JSON.stringify(err);
    if (s && s !== "null" && s !== "undefined") {
      return s;
    }
  } catch {
    // fall through
  }
  return "validation failed";
}

async function main(): Promise<void> {
  const raw = await readAllStdin();
  const input = JSON.parse(raw) as { params?: unknown };

  // `await` captures both synchronous throws from `type.fn` (invalid params)
  // and rejected promises from the implementation body in one branch.
  try {
    const result = await fetchWithTimeout(
      input.params as Parameters<typeof fetchWithTimeout>[0]
    );
    process.stdout.write(`OK ${JSON.stringify(result)}\n`);
  } catch (err) {
    process.stdout.write(`ERR ${formatError(err)}\n`);
  }
}

await main();