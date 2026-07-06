import AlchemystAI from '@alchemystai/sdk';

async function main() {
  const apiKey = process.env.ALCHEMYST_AI_API_KEY;
  if (!apiKey) {
    console.error('ALCHEMYST_AI_API_KEY is not set');
    process.exit(1);
  }
  const client = new AlchemystAI({ apiKey });
  const query = 'What is quantum supremacy and how do quantum computers achieve it?';

  const runId = 'test_add_resp_' + Math.random().toString(36).substring(7);

  const documents = [
    {
      content: 'To achieve supremacy, computers must perform calculations faster than any other system.',
      metadata: { file_name: `doc1_${runId}.md` }
    },
    {
      content: 'Quantum computers are devices that utilize quantum mechanics to process information.',
      metadata: { file_name: `doc2_${runId}.md` }
    },
    {
      content: 'Quantum computers are machines that use quantum physics to solve computational problems.',
      metadata: { file_name: `doc3_${runId}.md` }
    },
    {
      content: 'Quantum computing is a revolutionary technology for achieving computational speedups.',
      metadata: { file_name: `doc4_${runId}.md` }
    }
  ];

  console.log('Ingesting test documents...');
  try {
    const addResponse = await client.v1.context.add({
      documents: documents as any,
      context_type: 'resource',
      source: 'documentation',
      scope: 'internal',
      metadata: {
        fileName: `quantum_corpus_${runId}.md`,
        fileSize: 1024,
        fileType: 'text/markdown',
        lastModified: new Date().toISOString()
      }
    });
    console.log('Add Response:', JSON.stringify(addResponse, null, 2));
  } catch (err: any) {
    console.error('Add Error:', err);
  }
}

main().catch(console.error);
