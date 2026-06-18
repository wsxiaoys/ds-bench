import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { withAlchemyst } from '@alchemystai/aisdk';

type Phase = 'establish' | 'recall';

function parseArgs(argv: string[]): { phase: Phase } {
  let phase: string | undefined;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--phase') {
      phase = argv[i + 1];
      i++;
    } else if (arg.startsWith('--phase=')) {
      phase = arg.slice('--phase='.length);
    }
  }
  if (phase !== 'establish' && phase !== 'recall') {
    process.stderr.write(
      `Error: --phase must be either "establish" or "recall" (got: ${String(phase)}).\n`,
    );
    process.exit(2);
  }
  return { phase: phase as Phase };
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === '') {
    process.stderr.write(`Error: required environment variable ${name} is not set.\n`);
    process.exit(2);
  }
  return value;
}

async function main(): Promise<void> {
  const { phase } = parseArgs(process.argv.slice(2));

  const alchemystApiKey = requireEnv('ALCHEMYST_AI_API_KEY');
  const openaiApiKey = requireEnv('OPENAI_API_KEY');
  const runId = requireEnv('ZEALT_RUN_ID');

  // Ensure the OpenAI provider sees the key under the env var it expects.
  process.env.OPENAI_API_KEY = openaiApiKey;

  const userId = `vercel-memory-user-${runId}`;
  const sessionId =
    phase === 'establish' ? `establish-${runId}` : `recall-${runId}`;

  const wrappedGenerateText = withAlchemyst(generateText, {
    apiKey: alchemystApiKey,
  });

  const prompt =
    phase === 'establish'
      ? 'Please remember this about me: I am vegan and I am allergic to peanuts. Acknowledge that you will remember these dietary restrictions.'
      : 'Based on what you remember about my dietary restrictions, what should I avoid at a dinner party? List the exact dietary label(s) I previously told you (use the same word I used).';

  const result = await wrappedGenerateText({
    model: openai('gpt-4o-mini'),
    prompt,
    userId,
    sessionId,
  });

  const text = (result as { text?: string }).text ?? '';
  process.stdout.write(text);
  if (!text.endsWith('\n')) {
    process.stdout.write('\n');
  }
}

main().catch((err) => {
  process.stderr.write(`Fatal: ${err instanceof Error ? err.stack || err.message : String(err)}\n`);
  process.exit(1);
});
