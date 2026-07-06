const AlchemystAI = require('@alchemystai/sdk').default;
async function go() {
  const c = new AlchemystAI({ apiKey: process.env.ALCHEMYST_AI_API_KEY, logLevel: 'debug' });
  try {
    const r = await c.v1.context.search({
      query: 'engineering notes',
      similarity_threshold: 0.1,
      minimum_similarity_threshold: 0.1,
      scope: 'internal',
      body_metadata: {
        groupName: ['eng', 'v1']
      }
    });
    const ctxs = (r && r.contexts) || [];
    console.log('count=' + ctxs.length);
  } catch (e) {
    console.error('ERR', e.status, (e.message||'').slice(0,200));
  }
}
go();
