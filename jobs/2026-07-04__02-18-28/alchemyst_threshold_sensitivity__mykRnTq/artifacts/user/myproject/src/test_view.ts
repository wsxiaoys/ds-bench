import AlchemystAI from '@alchemystai/sdk';

async function main() {
  const apiKey = process.env.ALCHEMYST_AI_API_KEY;
  if (!apiKey) {
    console.error('ALCHEMYST_AI_API_KEY is not set');
    process.exit(1);
  }
  const client = new AlchemystAI({ apiKey });

  console.log('Viewing stored documents...');
  try {
    const stored = await client.v1.context.view.docs();
    console.log('Total documents:', stored);
  } catch (err: any) {
    console.error('Error viewing documents:', err.message);
  }
}

main().catch(console.error);
