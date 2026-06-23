import { pipeline, ArkErrors } from "./src/pipeline.ts";

async function main(): Promise<void> {
  // Read the entire raw CSV from stdin verbatim.
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const raw = Buffer.concat(chunks).toString("utf-8");

  const result = pipeline(raw);

  if (result instanceof ArkErrors) {
    // On failure: a single non-empty line of the form "INVALID: <message>"
    console.log(`INVALID: ${result.summary}`);
  } else {
    // On success: first non-empty line is "VALID", second is JSON array.
    // Serialize signupAt as ISO-8601 (Date.prototype.toISOString()).
    const serialized = result.map((r: Record<string, unknown>) => ({
      id: r.id,
      age: r.age,
      email: r.email,
      signupAt: (r.signupAt as Date).toISOString(),
    }));
    console.log("VALID");
    console.log(JSON.stringify(serialized));
  }
}

main().catch((err) => {
  console.error("INVALID:", err.message ?? String(err));
  process.exitCode = 0;
});
