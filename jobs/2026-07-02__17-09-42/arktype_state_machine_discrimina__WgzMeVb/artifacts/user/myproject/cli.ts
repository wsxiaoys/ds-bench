import { readFileSync } from "node:fs";
import { stdin } from "node:process";
import { ArkErrors } from "arktype";
import { transition } from "./src/transition.js";
import { State } from "./src/schemas.js";

/**
 * The stdin document shape:
 *   { "initial": <State>, "events": [<Event>, ...] }
 *
 * We accept any JSON-shaped object from `unknown` and narrow it through
 * ArkType so a malformed envelope produces a clear `INVALID: ...` line
 * rather than a TypeError.
 */
interface ReplayRequest {
  initial: unknown;
  events: unknown[];
}

function readStdin(): string {
  // Read everything available on stdin synchronously. tsx / node will
  // deliver EOF after the consumer closes the pipe, so `readFileSync`
  // against `/dev/stdin` is sufficient.
  return readFileSync(stdin.fd, "utf8");
}

function toInvalidLine(err: unknown): string {
  if (err instanceof ArkErrors) {
    return `INVALID: ${err.summary}`;
  }
  // `type.fn` throws a `TraversalError` whose `.arkErrors` field carries
  // the underlying `ArkErrors` from validation. Pull `summary` out so the
  // message is human-readable and matches the ArkErrors-style failure
  // described in the task.
  if (err && typeof err === "object" && "arkErrors" in err) {
    const inner = (err as { arkErrors: unknown }).arkErrors;
    if (inner instanceof ArkErrors) {
      return `INVALID: ${inner.summary}`;
    }
  }
  if (err instanceof Error) {
    return `INVALID: ${err.message}`;
  }
  return `INVALID: ${String(err)}`;
}

function main(): void {
  let raw: string;
  try {
    raw = readStdin();
  } catch (e) {
    process.stdout.write(toInvalidLine(e) + "\n");
    return;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    process.stdout.write(toInvalidLine(e) + "\n");
    return;
  }

  if (!parsed || typeof parsed !== "object") {
    process.stdout.write(`INVALID: input must be a JSON object\n`);
    return;
  }

  const req = parsed as Partial<ReplayRequest>;
  if (!("initial" in req) || !("events" in req)) {
    process.stdout.write(
      `INVALID: input must contain both "initial" and "events"\n`,
    );
    return;
  }
  if (!Array.isArray(req.events)) {
    process.stdout.write(`INVALID: "events" must be an array\n`);
    return;
  }

  try {
    // Validate the initial state against `State`. A failure here is a
    // malformed envelope and produces an `ArkErrors` instance, which is
    // surfaced through `INVALID: <summary>`.
    const initialCheck = State(req.initial);
    if (initialCheck instanceof ArkErrors) {
      process.stdout.write(toInvalidLine(initialCheck) + "\n");
      return;
    }
    let current = initialCheck;
    for (const ev of req.events) {
      // Each call validates both arguments and the return value; any
      // failure surfaces via the `TraversalError` thrown by `type.fn`.
      current = transition(current, ev as never);
    }
    process.stdout.write(`VALID\n${JSON.stringify(current)}\n`);
  } catch (e) {
    process.stdout.write(toInvalidLine(e) + "\n");
  }
}

main();
