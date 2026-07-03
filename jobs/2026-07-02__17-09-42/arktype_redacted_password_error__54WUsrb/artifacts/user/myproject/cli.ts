import { Signup, redactErrors } from "./src/validator.js";

/**
 * Read the entire stdin payload as a UTF-8 string.
 */
async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  return await new Promise((resolve, reject) => {
    process.stdin.on("data", chunk => chunks.push(Buffer.from(chunk)));
    process.stdin.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    process.stdin.on("error", err => reject(err));
  });
}

async function main(): Promise<void> {
  const raw = await readStdin();
  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch (err) {
    // The validator should still be run on a sentinel so that the failure is
    // reported through the configured error path; here we treat malformed
    // input as a validation failure.
    payload = {};
  }

  const result = Signup(payload as any);
  if (result && typeof (result as any).byPath === "object" && "summary" in (result as any)) {
    // ArkErrors instance
    redactErrors(result);
    process.stdout.write("INVALID: " + JSON.stringify(result) + "\n");
  } else {
    process.stdout.write("VALID\n" + JSON.stringify(result) + "\n");
  }
  // The CLI must exit with code 0 on both success and failure.
}

main().catch(err => {
  process.stdout.write("INVALID: " + JSON.stringify({ message: String(err) }) + "\n");
});
