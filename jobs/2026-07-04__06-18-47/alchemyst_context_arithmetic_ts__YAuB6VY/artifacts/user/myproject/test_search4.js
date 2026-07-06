const AlchemystAI = require('@alchemystai/sdk').default;
async function go() {
  const c = new AlchemystAI({ apiKey: process.env.ALCHEMYST_AI_API_KEY });
  // Try sending groupName directly in body as camelCase at top
  try {
    const r = await c.v1.context.search({
      query: 'engineering product API release version notes',
      similarity_threshold: 0.1,
      minimum_similarity_threshold: 0.1,
      scope: 'internal',
      mode: 'standard',
      groupName: ['eng', 'v1'],  // try at top
      metadata: 'true'
    });
    const ctxs = (r && r.contexts) || [];
    console.log('TOP-LEVEL groupName camelCase count=' + ctxs.length);
  } catch (e) {
    console.error('TOP-LEVEL ERR', e.status || '', (e.message||'').slice(0,200));
  }
  // Try snake_case group_name in body_metadata
  try {
    const r = await c.v1.context.search({
      query: 'engineering product API release version notes',
      similarity_threshold: 0.1,
      minimum_similarity_threshold: 0.1,
      scope: 'internal',
      mode: 'standard',
      body_metadata: {
        group_name: ['eng', 'v1']
      },
      metadata: 'true'
    });
    const ctxs = (r && r.contexts) || [];
    console.log('body_metadata group_name snake count=' + ctxs.length);
    for (const c of ctxs) console.log('  -', (c.content||'').slice(0, 80));
  } catch (e) {
    console.error('snake ERR', e.status || '', (e.message||'').slice(0,200));
  }
}
go();
