import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";
import { withAlchemyst } from "@alchemystai/aisdk";

/**
 * Cross-session memory CLI.
 *
 * Uses the Vercel AI SDK `generateText` wrapped with Alchemyst's `withAlchemyst`
 * middleware so that every call REDACTEDmatically retrieves past memories for the
 * given (userId, sessionId), injects them into the prompt, and persists the new
 * turn back to Alchemyst.
 *
 * Two phases:
 *   --phase establish  : tell the assistant a dietary preference (memory written)
 *   --phase recall      : a NEW session id is used; the assistant must answer
 *                         using the preference stored in the previous phase.
 *
 * Required environment variables:
 *   ALCHEMYST_AI_API_KEY  - Alchemyst API key
 *   OPENAI_API_KEY        - OpenAI API key
 *   RUN_ID                - namespaces user/session ids for parallel-run safety
 */

interface ParsedArgs {
  phase: "establish" | "recall";
}

function parseArgs(argv: string[]): ParsedArgs {
  let phase: string | undefined;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--phase") {
      phase = argv[i + 1];
      i++;
    } else if (arg.startsWith("--phase=")) {
      phase = arg.slice("--phase=".length);
    }
  }

  if (phase !== "establish" && phase !== "recall") {
    console.error(
      "Error: --phase must be one of 'establish' or 'recall'."
    );
    process.exit(1);
  }

  return { phase: phase as "establish" | "recall" };
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    console.error(`Error: environment variable ${name} is required but not set.`);
    process.exit(1);
  }
  return value;
}

async function main(): Promise<void> {
  const { phase } = parseArgs(process.argv.slice(2));

  const alchemystApiKey = requireEnv("ALCHEMYST_AI_API_KEY");
  const openaiApiKey = requireEnv("OPENAI_API_KEY");
  const runId = requireEnv("RUN_ID");

  // Make sure the OpenAI provider picks up the key.
  process.env.OPENAI_API_KEY = openaiApiKey;

  // Namespace user/session ids with RUN_ID for parallel-run safety.
  const userId = `vercel-memory-user-${runId}`;
  const sessionId =
    phase === "establish" ? `establish-${runId}` : `recall-${runId}`;

  // Wrap generateText with Alchemyst memory middleware.
  const generateTextWithMemory = withAlchemyst(generateText, {
    apiKey: alchemystApiKey,
  });

  const prompt =
    phase === "establish"
      ? "Please remember this about me: I am vegan and I am allergic to peanuts. Acknowledge that you will remember."
      : "Based on what you remember about my dietary restrictions, what should I avoid at a dinner party? List the exact dietary label(s) I told you.";

  const result = await generateTextWithMemory({
    model: openai("gpt-4o-mini"),
    prompt,
    userId,
    sessionId,
  });

  const text = result.text;
  process.stdout.write(text);
  if (!text.endsWith("\n")) {
    process.stdout.write("\n");
  }
}

main().catch((err: unknown) => {
  console.error(
    "Fatal error:",
    err instanceof Error ? err.message : String(err)
  );
  process.exit(1);
});