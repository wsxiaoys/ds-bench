import * as fs from 'fs';
import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { withAlchemyst } from '@alchemystai/aisdk';

async function run() {
  // 1. Parse CLI arguments
  const args = process.argv.slice(2);
  let phase: string | undefined;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--phase' && i + 1 < args.length) {
      phase = args[i + 1];
    }
  }

  if (!phase || (phase !== 'establish' && phase !== 'recall')) {
    console.error('Error: --phase <establish|recall> is required and must be either "establish" or "recall".');
    process.exit(1);
  }

  // 2. Resolve RUN_ID
  let runId = process.env.RUN_ID;
  if (!runId) {
    const runIdFilePath = '/logs/artifacts/run-id';
    if (fs.existsSync(runIdFilePath)) {
      try {
        runId = fs.readFileSync(runIdFilePath, 'utf8').trim();
      } catch (err) {
        console.error(`Error reading run-id file: ${err}`);
      }
    }
  }

  // 3. Validate environment
  if (!process.env.ALCHEMYST_AI_API_KEY) {
    console.error('Error: ALCHEMYST_AI_API_KEY environment variable is missing.');
    process.exit(1);
  }

  if (!process.env.OPENAI_API_KEY) {
    console.error('Error: OPENAI_API_KEY environment variable is missing.');
    process.exit(1);
  }

  if (!runId) {
    console.error('Error: RUN_ID is missing (neither process.env.RUN_ID is set nor /logs/artifacts/run-id file exists).');
    process.exit(1);
  }

  // 4. Construct user and session IDs
  const userId = `vercel-memory-user-${runId}`;
  const sessionId = phase === 'establish' ? `establish-${runId}` : `recall-${runId}`;

  // 5. Select prompt
  const prompt = phase === 'establish'
    ? 'Please remember this about me: I am vegan and I am allergic to peanuts. Acknowledge that you will remember.'
    : 'Based on what you remember about my dietary restrictions, what should I avoid at a dinner party? List the exact dietary label(s) I told you.';

  // 6. Wrap Vercel AI SDK with Alchemyst Context Engine middleware
  const generateTextWithMemory = withAlchemyst(generateText, {
    apiKey: process.env.ALCHEMYST_AI_API_KEY,
  });

  try {
    // 7. Call LLM with memory
    const response = await generateTextWithMemory({
      model: openai('gpt-4o-mini'),
      prompt,
      userId,
      sessionId,
    } as any); // Cast as any if TS complains about custom properties userId/sessionId on standard Vercel AI SDK types

    // 8. Output response to stdout
    console.log(response.text);
  } catch (error) {
    console.error('Error generating text with Alchemyst memory:', error);
    process.exit(1);
  }
}

run().catch((error) => {
  console.error('Unhandled execution error:', error);
  process.exit(1);
});
