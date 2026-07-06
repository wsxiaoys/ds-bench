import * as fs from 'fs';
import * as path from 'path';
import AlchemystAI from '@alchemystai/sdk';

async function main() {
  // 1. Verify API Key
  const apiKey = process.env.ALCHEMYST_AI_API_KEY;
  if (!apiKey) {
    console.error('Error: ALCHEMYST_AI_API_KEY environment variable is not set.');
    process.exit(1);
  }

  // 2. Parse CLI Arguments
  const args = process.argv.slice(2);
  let thresholdsCsv = '';
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--thresholds' && i + 1 < args.length) {
      thresholdsCsv = args[i + 1];
    } else if (args[i].startsWith('--thresholds=')) {
      thresholdsCsv = args[i].split('=')[1];
    }
  }

  if (!thresholdsCsv) {
    console.error('Error: --thresholds <csv> argument is required.');
    process.exit(1);
  }

  const thresholds = thresholdsCsv.split(',').map(val => {
    const num = parseFloat(val.trim());
    if (isNaN(num) || num < 0 || num > 1) {
      console.error(`Error: Invalid threshold value "${val}". Must be a number between 0 and 1.`);
      process.exit(1);
    }
    return num;
  });

  // 3. Read run-id
  const runIdPath = '/logs/artifacts/run-id';
  let runId = '';
  try {
    runId = fs.readFileSync(runIdPath, 'utf8').trim();
  } catch (err) {
    console.error(`Error reading run-id from ${runIdPath}:`, err);
    process.exit(1);
  }

  if (!runId) {
    console.error('Error: run-id is empty.');
    process.exit(1);
  }

  console.error(`Using run-id: ${runId}`);

  // 4. Initialize Alchemyst client
  const client = new AlchemystAI({ apiKey });

  // 5. Define Query and Corpus
  const query = 'What is quantum supremacy and how do quantum computers achieve it?';
  
  const documents = [
    {
      content: 'To achieve supremacy, computers must perform calculations faster than any other system.',
      metadata: {
        file_name: `doc1_${runId}.md`
      }
    },
    {
      content: 'Quantum computers are devices that utilize quantum mechanics to process information.',
      metadata: {
        file_name: `doc2_${runId}.md`
      }
    },
    {
      content: 'Quantum computers are machines that use quantum physics to solve computational problems.',
      metadata: {
        file_name: `doc3_${runId}.md`
      }
    },
    {
      content: 'Quantum computing is a revolutionary technology for achieving computational speedups.',
      metadata: {
        file_name: `doc4_${runId}.md`
      }
    }
  ];

  // 6. Ingest Corpus Idempotently
  console.error('Cleaning up previous ingestion for this run-id if any...');
  try {
    await client.v1.context.delete({
      source: 'documentation',
      metadata: { fileName: `quantum_corpus_${runId}.md` }
    } as any);
    console.error('✅ Previous version deleted.');
  } catch (error: any) {
    console.error('No previous version to delete or delete failed (proceeding):', error.message || error);
  }

  console.error('Ingesting corpus...');
  try {
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
    console.error('✅ Corpus ingestion successful.');
  } catch (error: any) {
    const isConflict = 
      error.status === 409 || 
      error.statusCode === 409 || 
      (error.message && error.message.includes('409')) ||
      (error.message && error.message.toLowerCase().includes('conflict')) ||
      error.code === 'CONFLICT';

    if (isConflict) {
      console.error('⚠️ Ingestion conflict (409), documents already exist. Proceeding to search phase.');
    } else {
      console.error('Error during ingestion:', error);
      process.exit(1);
    }
  }

  // 7. Search for each threshold
  const results: { threshold: number; count: number }[] = [];

  for (const threshold of thresholds) {
    console.error(`Searching at threshold ${threshold}...`);
    try {
      const response = await client.v1.context.search({
        query: query,
        minimum_similarity_threshold: threshold,
        similarity_threshold: 1.0,
        scope: 'internal',
        metadata: 'true'
      });
      
      const contexts = response.contexts || [];
      const filtered = contexts.filter(c => {
        const isOurRun = c.metadata && (c.metadata as any).file_name === `quantum_corpus_${runId}.md`;
        const meetsThreshold = c.score !== undefined && c.score >= threshold;
        return isOurRun && meetsThreshold;
      });
      const count = filtered.length;

      console.error(`Found ${count} contexts at threshold ${threshold} for run-id ${runId}.`);
      filtered.forEach(c => console.error(`  - score: ${c.score}, content: ${c.content?.substring(0, 60)}...`));
      results.push({ threshold, count });
    } catch (error) {
      console.error(`Error during search at threshold ${threshold}:`, error);
      process.exit(1);
    }
  }

  // 8. Output exact JSON object to stdout
  const output = {
    query: query,
    results: results
  };

  console.log(JSON.stringify(output, null, 2));
}

main().catch(err => {
  console.error('Unhandled error in main:', err);
  process.exit(1);
});
