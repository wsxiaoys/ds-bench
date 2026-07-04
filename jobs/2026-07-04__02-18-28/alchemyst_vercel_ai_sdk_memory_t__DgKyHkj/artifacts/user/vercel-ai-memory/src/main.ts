import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { withAlchemyst } from '@alchemystai/aisdk';
import * as fs from 'fs';

async function main() {
  // Read and validate RUN_ID
  let runId = process.env.RUN_ID;
  if (!runId) {
    try {
      const runIdPath = '/logs/artifacts/run-id';
      if (fs.existsSync(runIdPath)) {
        runId = fs.readFileSync(runIdPath, 'utf8').trim();
      }
    } catch (err) {
      // Ignore reading error, check runId below
    }
  }

  if (!runId) {
    console.error("Error: RUN_ID environment variable is missing.");
    process.exit(1);
  }

  // Read and validate API keys
  const alchemystApiKey = process.env.ALCHEMYST_AI_API_KEY;
  if (!alchemystApiKey) {
    console.error("Error: ALCHEMYST_AI_API_KEY environment variable is missing.");
    process.exit(1);
  }

  const openaiApiKey = process.env.OPENAI_API_KEY;
  if (!openaiApiKey) {
    console.error("Error: OPENAI_API_KEY environment variable is missing.");
    process.exit(1);
  }

  // Parse and validate --phase argument
  let phase: string | undefined;
  for (let i = 2; i < process.argv.length; i++) {
    if (process.argv[i] === '--phase') {
      phase = process.argv[i + 1];
      break;
    }
  }

  if (!phase || (phase !== 'establish' && phase !== 'recall')) {
    console.error("Error: --phase <establish|recall> argument is missing or invalid.");
    process.exit(1);
  }

  // Namespace user and session ids
  const userId = `vercel-memory-user-${runId}`;
  const sessionId = phase === 'establish' ? `establish-${runId}` : `recall-${runId}`;

  // Wrap generateText with Alchemyst
  const generateTextWithMemory = withAlchemyst(generateText, {
    apiKey: alchemystApiKey,
  });

  // Define prompts
  const prompt = phase === 'establish'
    ? "Please remember this about me: I am vegan and I am allergic to peanuts. Acknowledge that you will remember."
    : "Based on what you remember about my dietary restrictions, what should I avoid at a dinner party? List the exact dietary label(s) I told you.";

  try {
    // Call the wrapped generateText
    // @ts-ignore - in case of any TS type differences on the wrapper function
    const response = await generateTextWithMemory({
      model: openai('gpt-4o-mini'),
      prompt: prompt,
      userId: userId,
      sessionId: sessionId,
    });

    // Print the response text to stdout
    console.log(response.text);
  } catch (error) {
    console.error("Execution error:", error);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Unhandled error:", err);
  process.exit(1);
});
