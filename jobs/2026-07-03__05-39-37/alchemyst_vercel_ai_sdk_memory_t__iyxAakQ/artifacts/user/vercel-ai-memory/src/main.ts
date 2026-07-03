import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { withAlchemyst } from '@alchemystai/aisdk';

/** Print a message to stderr and exit with a non-zero status. */
function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

// --- Validate required environment variables (fail fast) ---------------------
const alchemystApiKey = process.env.ALCHEMYST_AI_API_KEY;
const openaiApiKey = process.env.OPENAI_API_KEY;
const runId = process.env.RUN_ID;

if (!alchemystApiKey) {
  fail('Missing ALCHEMYST_AI_API_KEY environment variable.');
}
if (!openaiApiKey) {
  fail('Missing OPENAI_API_KEY environment variable.');
}
if (!runId) {
  fail('Missing RUN_ID environment variable.');
}

// --- Parse --phase <establish|recall> ----------------------------------------
const phaseIndex = process.argv.indexOf('--phase');
const phase =
  phaseIndex !== -1 && phaseIndex + 1 < process.argv.length
    ? process.argv[phaseIndex + 1]
    : undefined;

if (phase !== 'establish' && phase !== 'recall') {
  fail(
    'Missing or invalid --phase argument. Usage: node dist/main.js --phase <establish|recall>',
  );
}

// --- Namespace user/session ids with RUN_ID for parallel-run safety ---------
const userId = `vercel-memory-user-${runId}`;
const sessionId =
  phase === 'establish' ? `establish-${runId}` : `recall-${runId}`;

// --- Wrap generateText with Alchemyst memory middleware ---------------------
const generateTextWithMemory = withAlchemyst(generateText, {
  apiKey: alchemystApiKey,
});

// The user message itself is what Alchemyst persists, so it must include the
// literal dietary label we want recalled later.
const prompt =
  phase === 'establish'
    ? 'Please remember this about me: I am vegan and I am allergic to peanuts. Acknowledge that you will remember.'
    : 'Based on what you remember about my dietary restrictions, what should I avoid at a dinner party? List the exact dietary label(s) I told you.';

async function main() {
  const result = await generateTextWithMemory({
    model: openai('gpt-4o-mini'),
    prompt,
    userId,
    sessionId,
  });

  const text = result.text ?? '';
  process.stdout.write(text + '\n');
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});