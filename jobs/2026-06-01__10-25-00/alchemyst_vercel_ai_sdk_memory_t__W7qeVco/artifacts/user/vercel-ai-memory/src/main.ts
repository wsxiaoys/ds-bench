import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { withAlchemyst } from '@alchemystai/aisdk';

async function main() {
  const ALCHEMYST_AI_API_KEY = process.env.ALCHEMYST_AI_API_KEY;
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  const ZEALT_RUN_ID = process.env.ZEALT_RUN_ID;

  if (!ALCHEMYST_AI_API_KEY) {
    console.error("Error: ALCHEMYST_AI_API_KEY environment variable is missing.");
    process.exit(1);
  }

  if (!OPENAI_API_KEY) {
    console.error("Error: OPENAI_API_KEY environment variable is missing.");
    process.exit(1);
  }

  if (!ZEALT_RUN_ID) {
    console.error("Error: ZEALT_RUN_ID environment variable is missing.");
    process.exit(1);
  }

  // Parse CLI arguments
  const args = process.argv.slice(2);
  let phase: string | null = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--phase') {
      phase = args[i + 1] || null;
      break;
    }
  }

  if (!phase || (phase !== 'establish' && phase !== 'recall')) {
    console.error("Error: --phase must be set to 'establish' or 'recall'.");
    process.exit(1);
  }

  // Namespaced user and session identifiers
  const userId = `vercel-memory-user-${ZEALT_RUN_ID}`;
  const sessionId = phase === 'establish' ? `establish-${ZEALT_RUN_ID}` : `recall-${ZEALT_RUN_ID}`;

  // Wrap generateText with Alchemyst middleware
  const wrappedGenerateText = withAlchemyst(generateText, {
    apiKey: ALCHEMYST_AI_API_KEY,
  });

  try {
    let prompt = '';
    if (phase === 'establish') {
      prompt = 'Please remember this about me: I am vegan and I am allergic to peanuts. Acknowledge that you will remember.';
    } else {
      prompt = 'Based on what you remember about my dietary restrictions, what should I avoid at a dinner party? List the exact dietary label(s) I told you.';
    }

    const response = await wrappedGenerateText({
      model: openai('gpt-4o-mini'),
      prompt,
      userId,
      sessionId,
    });

    // Print the model's response text to stdout
    console.log(response.text);
    process.exit(0);
  } catch (error) {
    console.error("Error executing generateText:", error);
    process.exit(1);
  }
}

main();
