import { ArkErrors } from "arktype";
import { State, Event } from "./state.js";
import { transition } from "./transition.js";

async function main(): Promise<void> {
  // Read all of stdin
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.from(chunk));
  }
  const input = Buffer.concat(chunks).toString("utf-8").trim();

  let parsed: { initial: unknown; events: unknown[] };

  // Parse the JSON input
  try {
    parsed = JSON.parse(input);
  } catch {
    process.stdout.write("INVALID: Failed to parse JSON input\n");
    return;
  }

  if (parsed === null || typeof parsed !== "object") {
    process.stdout.write("INVALID: Input must be a JSON object\n");
    return;
  }

  const doc = parsed as Record<string, unknown>;

  // Validate the initial state
  const initialResult = State(doc.initial);
  if (initialResult instanceof ArkErrors) {
    process.stdout.write(`INVALID: Invalid initial state: ${initialResult.summary}\n`);
    return;
  }

  if (!Array.isArray(doc.events)) {
    process.stdout.write("INVALID: 'events' must be an array\n");
    return;
  }

  let currentState = initialResult;

  // Replay events through transition
  for (let i = 0; i < doc.events.length; i++) {
    const eventResult = Event(doc.events[i]);
    if (eventResult instanceof ArkErrors) {
      process.stdout.write(
        `INVALID: Invalid event at index ${i}: ${eventResult.summary}\n`
      );
      return;
    }

    try {
      currentState = transition(currentState, eventResult);
    } catch (err) {
      // The transition function's runtime validation caught an invalid
      // state produced by the transition logic or an invalid input.
      const message =
        err instanceof ArkErrors
          ? err.summary
          : err instanceof Error
            ? err.message
            : String(err);
      process.stdout.write(
        `INVALID: Transition produced invalid state at event index ${i}: ${message}\n`
      );
      return;
    }
  }

  // Output success
  process.stdout.write("VALID\n");
  process.stdout.write(JSON.stringify(currentState) + "\n");
}

main().catch((err) => {
  process.stdout.write(`INVALID: Unexpected error: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(0);
});
