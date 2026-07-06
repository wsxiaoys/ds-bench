import { type } from "arktype";
import { State } from "./src/state.js";
import { Event } from "./src/event.js";
import { transition } from "./src/transition.js";

// Read the entire stdin into a single string.
async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

// Convert an arktype error (ArkError or ArkErrors) into a single-line
// description suitable for the CLI's INVALID: output.
function describeError(err: unknown): string {
  if (err && typeof err === "object" && "summary" in err) {
    return String((err as { summary: unknown }).summary);
  }
  if (err instanceof Error) {
    return err.message;
  }
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

// Format the failure line: trim internal whitespace, then prefix with
// "INVALID: ". The whole line must be non-empty.
function formatInvalid(err: unknown): string {
  return `INVALID: ${describeError(err).replace(/\s+/g, " ").trim()}`;
}

async function main(): Promise<void> {
  let raw: string;
  try {
    raw = await readStdin();
  } catch (err) {
    console.log(formatInvalid(err));
    return;
  }

  // 1. Parse the JSON document from stdin.
  let doc: unknown;
  try {
    doc = JSON.parse(raw);
  } catch (err) {
    console.log(formatInvalid(err));
    return;
  }

  // 2. Validate the document's shape: { initial: State, events: Event[] }.
  const Document = type({
    initial: State,
    events: Event.array(),
  });
  const validatedDoc = Document(doc);
  if (validatedDoc instanceof type.errors) {
    console.log(formatInvalid(validatedDoc));
    return;
  }

  // 3. Replay events through the (runtime-validated) transition function.
  let current = validatedDoc.initial;
  for (const event of validatedDoc.events) {
    try {
      current = transition(current, event);
    } catch (err) {
      console.log(formatInvalid(err));
      return;
    }
  }

  // 4. Final state must itself be a valid State. The fn() wrapper already
  //    validates the return value, but the loop above replaces `current` only
  //    when transition succeeds, so this is a defensive final check.
  const validatedFinal = State(current);
  if (validatedFinal instanceof type.errors) {
    console.log(formatInvalid(validatedFinal));
    return;
  }

  // 5. Emit the success output: two non-empty lines.
  console.log("VALID");
  console.log(JSON.stringify(validatedFinal));
}

main().catch((err) => {
  // The CLI must always exit with code 0, so swallow any unexpected error
  // and emit a final INVALID: line instead.
  console.log(formatInvalid(err));
});
