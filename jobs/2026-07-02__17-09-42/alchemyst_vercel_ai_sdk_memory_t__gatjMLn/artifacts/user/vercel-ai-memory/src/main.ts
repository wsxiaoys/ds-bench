/**
 * Cross-Session Memory CLI: Vercel AI SDK + Alchemyst middleware.
 *
 * Usage:
 *   node dist/main.js --phase establish
 *   node dist/main.js --phase recall
 *
 * Environment:
 *   ALCHEMYST_AI_API_KEY   (required) Alchemyst API key
 *   OPENAI_API_KEY         (required) OpenAI API key
 *   RUN_ID                 (required) Per-run namespace (read from /logs/artifacts/run-id)
 */

import { readFileSync } from "node:fs";
import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";
import { withAlchemyst } from "@alchemystai/aisdk";

type Phase = "establish" | "recall";

const PHASE_VALUES: ReadonlyArray<Phase> = ["establish", "recall"];

/**
 * Read the run id from /logs/artifacts/run-id as required by the parallel-run
 * safety contract. We accept the RUN_ID env var as the canonical source (the
 * harness sets it) but fall back to reading the file in case it is missing.
 */
function readRunId(): string | undefined {
  if (process.env.RUN_ID && process.env.RUN_ID.trim() !== "") {
    return process.env.RUN_ID.trim();
  }
  try {
    // Fallback to the on-disk file if the env var was not exported.
    const raw = readFileSync("/logs/artifacts/run-id", "utf8");
    const trimmed = raw.trim();
    return trimmed === "" ? undefined : trimmed;
  } catch {
    return undefined;
  }
}

function fail(message: string): never {
  process.stderr.write(`error: ${message}\n`);
  process.exit(1);
}

/**
 * Parse --phase <value> out of argv. Supports both `--phase value` and
 * `--phase=value` forms. Returns undefined if not provided.
 */
function parsePhase(argv: ReadonlyArray<string>): Phase | undefined {
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--phase") {
      const value = argv[i + 1];
      if (value && !value.startsWith("--")) {
        return value as Phase;
      }
      return undefined;
    }
    if (arg.startsWith("--phase=")) {
      return arg.slice("--phase=".length) as Phase;
    }
  }
  return undefined;
}

async function main(): Promise<void> {
  const phase = parsePhase(process.argv.slice(2));
  if (!phase || !PHASE_VALUES.includes(phase)) {
    fail(
      `Missing or invalid --phase argument. Expected one of: ${PHASE_VALUES.join(", ")}.`,
    );
  }

  const alchemystKey = process.env.ALCHEMYST_AI_API_KEY;
  if (!alchemystKey || alchemystKey.trim() === "") {
    fail("ALCHEMYST_AI_API_KEY environment variable is required.");
  }

  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey || openaiKey.trim() === "") {
    fail("OPENAI_API_KEY environment variable is required.");
  }

  const runId = readRunId();
  if (!runId) {
    fail(
      "RUN_ID environment variable is required (read from /logs/artifacts/run-id).",
    );
  }

  // Parallel-run safety: namespace identifiers with the run id so concurrent
  // invocations against the same Alchemyst account don't cross-contaminate.
  const userId = `vercel-memory-user-${runId}`;
  const sessionId = `${phase}-${runId}`;

  // Build the Alchemyst-wrapped generateText. The wrapper handles memory
  // retrieval (injects past memories into the system prompt) and memory
  // persistence (stores both user and assistant turns) keyed by (userId, sessionId).
  const wrappedGenerateText = withAlchemyst(generateText, {
    apiKey: alchemystKey,
  });

  // Phase-specific prompts. The user message is what Alchemyst persists, so
  // the establish phase prompt explicitly contains the literal word "vegan".
  const prompts: Record<Phase, string> = {
    establish:
      "Please remember this about me: I am vegan and I am allergic to peanuts. " +
      "Acknowledge that you will remember.",
    recall:
      "Based on what you remember about my dietary restrictions, " +
      "what should I avoid at a dinner party? List the exact dietary label(s) I told you.",
  };

  const userMessage = prompts[phase];

  const result = await wrappedGenerateText({
    model: openai("gpt-4o-mini"),
    messages: [{ role: "user", content: userMessage }],
    userId,
    sessionId,
  });

  // Print only the model's response text to stdout.
  process.stdout.write(result.text);
  if (!result.text.endsWith("\n")) {
    process.stdout.write("\n");
  }
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  process.stderr.write(`fatal: ${message}\n`);
  process.exit(1);
});