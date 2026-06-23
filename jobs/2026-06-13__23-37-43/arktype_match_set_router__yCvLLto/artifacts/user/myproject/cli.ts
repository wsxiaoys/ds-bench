import { TraversalError } from "arktype";
import { route } from "./src/router.ts";

// ── Read all of stdin ──────────────────────────────────────────────────────
const chunks: Buffer[] = [];
for await (const chunk of process.stdin) {
  chunks.push(chunk as Buffer);
}
const raw = Buffer.concat(chunks).toString("utf8");

// ── Parse the top-level JSON document ─────────────────────────────────────
let doc: { events: unknown[] };
try {
  const parsed = JSON.parse(raw) as unknown;
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    !Array.isArray((parsed as Record<string, unknown>).events)
  ) {
    process.stdout.write(
      `ERR input must be an object with an "events" array\n`,
    );
    process.exit(0);
  }
  doc = parsed as { events: unknown[] };
} catch (err) {
  process.stdout.write(`ERR failed to parse JSON: ${String(err)}\n`);
  process.exit(0);
}

// ── Dispatch each event through the router ────────────────────────────────
for (const event of doc.events) {
  try {
    const result = route(event as never);
    process.stdout.write(`${result}\n`);
  } catch (err) {
    // TraversalError is thrown by the "assert" default when no case matches.
    // Print the ERR line and stop – exit code is always 0.
    if (err instanceof TraversalError) {
      process.stdout.write(`ERR ${err.message}\n`);
    } else {
      process.stdout.write(`ERR ${String(err)}\n`);
    }
    process.exit(0);
  }
}
