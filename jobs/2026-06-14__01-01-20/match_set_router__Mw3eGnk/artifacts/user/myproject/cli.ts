import { route } from "./router.ts";
import { TraversalError } from "arktype";

async function main(): Promise<void> {
  // Read all of stdin
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.from(chunk));
  }
  const raw = Buffer.concat(chunks).toString("utf-8");

  let input: { events: unknown[] };
  try {
    input = JSON.parse(raw);
  } catch {
    // Invalid JSON — no events processed, exit 0
    process.exit(0);
  }

  const events: unknown[] = input.events ?? [];

  for (const event of events) {
    try {
      const result = route(event);
      process.stdout.write(String(result) + "\n");
    } catch (err) {
      if (err instanceof TraversalError) {
        process.stdout.write(`ERR ${err.message}\n`);
      } else {
        // Unexpected error — still print ERR line and stop
        process.stdout.write(`ERR ${String(err)}\n`);
      }
      return; // stop processing remaining events
    }
  }
}

main().then(() => process.exit(0));
