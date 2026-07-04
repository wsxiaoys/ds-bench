import AlchemystAI from '@alchemystai/sdk';

async function main() {
  const apiKey = process.env.ALCHEMYST_AI_API_KEY;
  if (!apiKey) {
    console.error('ALCHEMYST_AI_API_KEY is not set');
    process.exit(1);
  }
  const client = new AlchemystAI({ apiKey });
  const query = 'What is quantum supremacy and how do quantum computers achieve it?';

  const runId = 'test_scores_v5_' + Math.random().toString(36).substring(7);

  const documents = [
    {
      content: 'Quantum computers are machines that use quantum physics to solve computational problems.',
      metadata: { file_name: `doc1_${runId}.md` }
    },
    {
      content: 'Quantum computers are advanced systems designed to perform computational tasks.',
      metadata: { file_name: `doc2_${runId}.md` }
    },
    {
      content: 'Quantum computing allows computers to perform calculations much faster than classical systems.',
      metadata: { file_name: `doc3_${runId}.md` }
    },
    {
      content: 'Quantum computers are devices that utilize quantum mechanics to process information.',
      metadata: { file_name: `doc4_${runId}.md` }
    },
    {
      content: 'To achieve supremacy, computers must perform calculations faster than any other system.',
      metadata: { file_name: `doc5_${runId}.md` }
    },
    {
      content: 'Quantum computing is a revolutionary technology for achieving computational speedups.',
      metadata: { file_name: `doc6_${runId}.md` }
    }
  ];

  console.log('Ingesting test documents...');
  await client.v1.context.add({
    documents: documents as any,
    context_type: 'resource',
    source: 'documentation',
    scope: 'internal',
    metadata: {
      fileName: `test_scores_corpus_${runId}.md`,
      fileSize: 1024,
      fileType: 'text/markdown',
      lastModified: new Date().toISOString()
    }
  });

  console.log('Searching...');
  const response = await client.v1.context.search({
    query: query,
    minimum_similarity_threshold: 0.0,
    similarity_threshold: 1.0,
    scope: 'internal',
    metadata: 'true'
  });

  console.log('Results:');
  response.contexts?.forEach((c: any) => {
    if (c.metadata?.file_name === `test_scores_corpus_${runId}.md`) {
      console.log(`- score: ${c.score}, content: ${c.content}`);
    }
  });
}

main().catch(console.error);
