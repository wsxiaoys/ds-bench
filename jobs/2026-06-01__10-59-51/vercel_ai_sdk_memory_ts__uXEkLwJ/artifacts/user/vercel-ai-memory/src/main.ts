import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { withAlchemyst } from '@alchemystai/aisdk';
import * as dotenv from 'dotenv';

dotenv.config();

async function main() {
  const ALCHEMYST_AI_API_KEY = process.env.ALCHEMYST_AI_API_KEY;
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  const ZEALT_RUN_ID = process.env.ZEALT_RUN_ID;

  if (!ALCHEMYST_AI_API_KEY || !OPENAI_API_KEY || !ZEALT_RUN_ID) {
    console.error('Missing required environment variables (ALCHEMYST_AI_API_KEY, OPENAI_API_KEY, ZEALT_RUN_ID)');
    process.exit(1);
  }

  const args = process.argv.slice(2);
  const phaseIndex = args.indexOf('--phase');
  if (phaseIndex === -1 || phaseIndex + 1 >= args.length) {
    console.error('Missing --phase argument');
    process.exit(1);
  }

  const phase = args[phaseIndex + 1];
  if (phase !== 'establish' && phase !== 'recall') {
    console.error('Invalid phase. Must be establish or recall');
    process.exit(1);
  }

  const userId = `vercel-memory-user-${ZEALT_RUN_ID}`;
  const sessionId = `${phase}-${ZEALT_RUN_ID}`;

  const wrappedGenerateText = withAlchemyst(generateText, {
    apiKey: ALCHEMYST_AI_API_KEY,
  });

  const model = openai('gpt-4o-mini');

  if (phase === 'establish') {
    const prompt = "Please remember this about me: I am vegan and I am allergic to peanuts. Acknowledge that you will remember.";
    const { text } = await wrappedGenerateText({
      model,
      prompt,
      userId,
      sessionId,
    } as any);
    console.log(text);
  } else if (phase === 'recall') {
    const prompt = "Based on what you remember about my dietary restrictions, what should I avoid at a dinner party? List the exact dietary label(s) I told you.";
    const { text } = await wrappedGenerateText({
      model,
      prompt,
      userId,
      sessionId,
    } as any);
    console.log(text);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
