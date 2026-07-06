const AlchemystAI = require('@alchemystai/sdk').default;
async function go() {
  const c = new AlchemystAI({ apiKey: process.env.ALCHEMYST_AI_API_KEY });
  try {
    const r = await c.v1.context.search({
      query: 'engineering product API release version notes',
      similarity_threshold: 0.1,
      minimum_similarity_threshold: 0.1,
      scope: 'internal',
      mode: 'standard',
      body_metadata: {
        groupName: ['eng', 'v1']
      },
      metadata: 'true'
    });
    const ctxs = (r && r.contexts) || [];
    console.log('count=' + ctxs.length);
    for (const c of ctxs) {
      console.log('  -', (c.content||'').slice(0, 80));
    }
  } catch (e) {
    console.error('ERR', e.status, e.message);
    console.error('BODY', e.error);
  }
}
go();
