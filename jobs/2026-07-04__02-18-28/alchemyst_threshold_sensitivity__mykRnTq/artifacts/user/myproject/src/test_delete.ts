import AlchemystAI from '@alchemystai/sdk';

async function main() {
  const apiKey = process.env.ALCHEMYST_AI_API_KEY;
  if (!apiKey) {
    console.error('ALCHEMYST_AI_API_KEY is not set');
    process.exit(1);
  }
  const client = new AlchemystAI({ apiKey });

  const runId = 'zrklugu333';
  const fileName = `quantum_corpus_${runId}.md`;

  const payloads = [
    {
      label: 'Payload 1: by_doc + metadata.fileName',
      body: {
        source: 'documentation',
        by_doc: true,
        metadata: { fileName }
      }
    },
    {
      label: 'Payload 2: by_doc + file_name',
      body: {
        source: 'documentation',
        by_doc: true,
        file_name: fileName
      }
    },
    {
      label: 'Payload 3: by_doc + metadata.file_name',
      body: {
        source: 'documentation',
        by_doc: true,
        metadata: { file_name: fileName }
      }
    },
    {
      label: 'Payload 4: by_id + id',
      body: {
        source: 'documentation',
        by_id: true,
        id: fileName
      }
    },
    {
      label: 'Payload 5: by_id + _id',
      body: {
        source: 'documentation',
        by_id: true,
        _id: fileName
      }
    }
  ];

  for (const p of payloads) {
    console.log(`\n--- Testing ${p.label} ---`);
    try {
      const resp = await client.v1.context.delete(p.body as any);
      console.log('Delete response:', resp);

      // Check if still exists
      const stored = await client.v1.context.view.docs();
      const found = stored.documents?.some((d: any) => d._id === fileName);
      console.log(`Still exists?`, found);
      if (!found) {
        console.log('🎉 SUCCESS! This payload successfully deleted the document!');
        break;
      }
    } catch (err: any) {
      console.log('Error:', err.message || err);
    }
  }
}

main().catch(console.error);
