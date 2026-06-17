import { ArkErrors } from "arktype";
import { State, Event, transition } from "./src/types.js";

// ---------------------------------------------------------------------------
// Read stdin to completion
// ---------------------------------------------------------------------------

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks).toString("utf8");
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const raw = await readStdin();

  // Parse the outer JSON envelope
  let envelope: unknown;
  try {
    envelope = JSON.parse(raw);
  } catch (err) {
    process.stdout.write(
      `INVALID: failed to parse JSON input: ${(err as Error).message}\n`,
    );
    process.exit(0);
  }

  // Basic shape check before destructuring
  if (
    typeof envelope !== "object" ||
    envelope === null ||
    !("initial" in envelope) ||
    !("events" in envelope) ||
    !Array.isArray((envelope as { events: unknown }).events)
  ) {
    process.stdout.write(
      `INVALID: input must be an object with "initial" (State) and "events" (array) fields\n`,
    );
    process.exit(0);
  }

  const { initial, events } = envelope as { initial: unknown; events: unknown[] };

  // Validate the initial state
  const initialResult = State(initial);
  if (initialResult instanceof ArkErrors) {
    process.stdout.write(`INVALID: initial state is invalid – ${initialResult.summary}\n`);
    process.exit(0);
  }

  // Replay events through the validated transition function
  let current: typeof State.infer = initialResult;

  for (let i = 0; i < events.length; i++) {
    const rawEvent = events[i];

    // Validate the event itself before passing to transition
    const eventResult = Event(rawEvent);
    if (eventResult instanceof ArkErrors) {
      process.stdout.write(
        `INVALID: event at index ${i} is invalid – ${eventResult.summary}\n`,
      );
      process.exit(0);
    }

    // Call the validated transition function; it also validates the return value
    try {
      current = transition(current, eventResult);
    } catch (err) {
      // ArkErrors thrown when the return value doesn't match State
      const summary =
        err instanceof ArkErrors ? err.summary : String(err);
      process.stdout.write(
        `INVALID: transition produced an invalid state at event index ${i} – ${summary}\n`,
      );
      process.exit(0);
    }
  }

  // All good – emit the final state
  process.stdout.write(`VALID\n${JSON.stringify(current)}\n`);
  process.exit(0);
}

main();
