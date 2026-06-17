import { scope } from "arktype";

// ---------------------------------------------------------------------------
// Define the three payload shapes in a scope so their names can be used as
// plain string keys inside the match({}) call, satisfying the
// match({...})({...}) call-signature requirement.
// ---------------------------------------------------------------------------
const payloadScope = scope({
  success: { status: '"success"', data: "object" },
  error: { status: '"error"', code: "number", reason: "string" },
  pending: { status: '"pending"' },
});

// ---------------------------------------------------------------------------
// Build the matcher using match({...}) syntax with default: "assert" so that
// any input that matches none of the three branches throws a TraversalError.
// ---------------------------------------------------------------------------
export const handlePayload = payloadScope.type.match({
  success: (v) => `OK: ${JSON.stringify(v.data)}`,
  error: (v) => `ERR ${v.code} ${v.reason}`,
  pending: () => "PENDING",
  default: "assert",
});

// ---------------------------------------------------------------------------
// Stdin / stdout entrypoint
// ---------------------------------------------------------------------------
async function main(): Promise<void> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk as Buffer);
  }
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  const input: unknown = JSON.parse(raw);

  // handlePayload throws (TraversalError) when no branch matches.
  const result = handlePayload(input as never);
  process.stdout.write(result + "\n");
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  process.stderr.write(`Error: ${message}\n`);
  process.exit(1);
});
