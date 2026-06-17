import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";
import { withAlchemyst } from "@alchemystai/aisdk";

// Validate required environment variables
const ALCHEMYST_AI_API_KEY = process.env.ALCHEMYST_AI_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const ZEALT_RUN_ID = process.env.ZEALT_RUN_ID;

if (!ALCHEMYST_AI_API_KEY) {
  process.stderr.write("Error: ALCHEMYST_AI_API_KEY environment variable is required.\n");
  process.exit(1);
}
if (!OPENAI_API_KEY) {
  process.stderr.write("Error: OPENAI_API_KEY environment variable is required.\n");
  process.exit(1);
}
if (!ZEALT_RUN_ID) {
  process.stderr.write("Error: ZEALT_RUN_ID environment variable is required.\n");
  process.exit(1);
}

// Parse --phase argument
const args = process.argv.slice(2);
let phase: string | undefined;
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--phase" && args[i + 1]) {
    phase = args[i + 1];
    break;
  }
}

if (!phase || (phase !== "establish" && phase !== "recall")) {
  process.stderr.write("Error: --phase must be 'establish' or 'recall'.\n");
  process.exit(1);
}

// Namespace user and session IDs with ZEALT_RUN_ID for parallel-run safety
const userId = `vercel-memory-user-${ZEALT_RUN_ID}`;
const sessionId =
  phase === "establish"
    ? `establish-${ZEALT_RUN_ID}`
    : `recall-${ZEALT_RUN_ID}`;

// Wrap generateText with Alchemyst memory middleware
const wrappedGenerateText = withAlchemyst(generateText, {
  apiKey: ALCHEMYST_AI_API_KEY,
});

async function main() {
  let prompt: string;

  if (phase === "establish") {
    prompt =
      "Please remember this about me: I am vegan and I am allergic to peanuts. Acknowledge that you will remember.";
  } else {
    prompt =
      "Based on what you remember about my dietary restrictions, what should I avoid at a dinner party? List the exact dietary label(s) I told you.";
  }

  const result = await wrappedGenerateText({
    model: openai("gpt-4o-mini"),
    prompt,
    userId,
    sessionId,
  });

  process.stdout.write(result.text + "\n");
}

main().catch((err) => {
  process.stderr.write(`Error: ${err.message}\n`);
  process.exit(1);
});