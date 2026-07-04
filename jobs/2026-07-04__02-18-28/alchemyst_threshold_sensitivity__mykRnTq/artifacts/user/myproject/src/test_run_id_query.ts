import AlchemystAI from '@alchemystai/sdk';

async function main() {
  const apiKey = process.env.ALCHEMYST_AI_API_KEY;
  if (!apiKey) {
    console.error('ALCHEMYST_AI_API_KEY is not set');
    process.exit(1);
  }
  const client = new AlchemystAI({ apiKey });

  const runId = 'test_run_id_query_' + Math.random().toString(36).substring(7);
  const query = `What is quantum supremacy and how do quantum computers achieve it in run ${runId}?`;

  const documents = [
    {
      content: `To achieve supremacy, computers must perform calculations faster than any other system in run ${runId}.`,
      metadata: { file_name: `doc1_${runId}.md` }
    },
    {
      content: `Quantum computers are devices that utilize quantum mechanics to process information in run ${runId}.`,
      metadata: { file_name: `doc2_${runId}.md` }
    },
    {
      content: `Quantum computers are machines that use quantum physics to solve computational problems in run ${runId}.`,
      metadata: { file_name: `doc3_${runId}.md` }
    },
    {
      content: `Quantum computing is a revolutionary technology for achieving computational speedups in run ${runId}.`,
      metadata: { file_name: `doc4_${runId}.md` }
    }
  ];

  console.log('Ingesting test documents with runId in content...');
  await client.v1.context.add({
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

  // Let's wait 3 seconds
  console.log('Waiting 3 seconds for indexing...');
  await new Promise(resolve => setTimeout(resolve, 3000));

  console.log('Searching...');
  const response = await client.v1.context.search({
    query: query,
    minimum_similarity_threshold: 0.0,
    similarity_threshold: 1.0,
    scope: 'internal',
    metadata: 'true'
  });

  const contexts = response.contexts || [];
  console.log(`Total contexts returned: ${contexts.length}`);
  contexts.forEach((c, idx) => {
    console.log(`Context ${idx}: score: ${c.score}, file_name: ${(c as any).metadata?.file_name}, content: ${c.content?.substring(0, 60)}...`);
  });
}

main().catch(console.error);
