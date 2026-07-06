const AlchemystAI = require('@alchemystai/sdk').default;
async function go() {
  const c = new AlchemystAI({ apiKey: process.env.ALCHEMYST_AI_API_KEY });
  try {
    const r = await c.v1.context.search({
      query: 'engineering product API release version notes',
      similarity_threshold: 0.1,
      minimum_similarity_threshold: 0.1,
      scope: 'internal',
      metadata: {
        groupName: ['eng', 'v1']
      }
    });
    console.log(JSON.stringify(r, null, 2));
  } catch (e) {
    console.error('ERR', e.status, e.message);
    console.error('BODY', e.error);
  }
}
go();
