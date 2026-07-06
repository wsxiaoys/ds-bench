import AlchemystAI from '@alchemystai/sdk';

async function main() {
  const apiKey = process.env.ALCHEMYST_AI_API_KEY;
  if (!apiKey) {
    console.error('ALCHEMYST_AI_API_KEY is not set');
    process.exit(1);
  }
  const client = new AlchemystAI({ apiKey });
  const query = 'What is quantum supremacy and how do quantum computers achieve it?';

  const testCases = [
    { min: 0.5, max: 1.0 },
    { min: 0.7, max: 1.0 },
    { min: 0.9, max: 1.0 },
    { min: 0.0, max: 0.5 },
    { min: 0.0, max: 0.7 },
    { min: 0.0, max: 0.9 },
    { min: 0.5, max: 0.5 },
    { min: 0.7, max: 0.7 },
    { min: 0.9, max: 0.9 }
  ];

  for (const tc of testCases) {
    console.log(`\n--- Search with min: ${tc.min}, max: ${tc.max} ---`);
    try {
      const response = await client.v1.context.search({
        query: query,
        minimum_similarity_threshold: tc.min,
        similarity_threshold: tc.max,
        scope: 'internal',
        metadata: 'true'
      });
      console.log('Count:', response.contexts?.length);
      response.contexts?.forEach((c: any) => console.log(`- score: ${c.score}, content: ${c.content.substring(0, 40)}...`));
    } catch (e: any) {
      console.log('Error:', e.message);
    }
  }
}

main().catch(console.error);
