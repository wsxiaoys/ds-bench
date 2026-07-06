const AlchemystAI = require('@alchemystai/sdk').default;
async function go() {
  const c = new AlchemystAI({ apiKey: process.env.ALCHEMYST_AI_API_KEY });
  const seeds = [
    { key: 'ENG_V1_DOC', groups: ['eng','v1'], content: 'ENG_V1_DOC engineering notes for API version 1 of our REST platform' },
    { key: 'ENG_V2_DOC', groups: ['eng','v2'], content: 'ENG_V2_DOC engineering notes for API version 2 of our REST platform' },
    { key: 'PRODUCT_V1_DOC', groups: ['product','v1'], content: 'PRODUCT_V1_DOC product notes for release version 1 GA launch' },
    { key: 'PRODUCT_V2_DOC', groups: ['product','v2'], content: 'PRODUCT_V2_DOC product notes for release version 2 GA launch' },
  ];
  const runId = 'NEW_' + Date.now();
  for (const s of seeds) {
    await c.v1.context.add({
      context_type: 'resource',
      scope: 'internal',
      source: 'platform.api.context.add',
      documents: [{ content: s.content }],
      metadata: {
        fileName: s.key + '-' + runId + '.md',
        fileType: 'text/markdown',
        fileSize: s.content.length,
        lastModified: new Date().toISOString(),
        group_name: s.groups,
      }
    });
  }
  console.log('ingested for runId=' + runId);
  await new Promise(r=>setTimeout(r, 2000));
  for (const groups of [['eng','v1'],['eng'],['v1'],['eng','product']]) {
    const r = await c.v1.context.search({
      query: 'engineering product API release version notes',
      similarity_threshold: 0.1,
      minimum_similarity_threshold: 0.1,
      scope: 'internal',
      body_metadata: { groupName: groups },
    });
    const ctxs = (r && r.contexts) || [];
    console.log('--- groups=' + JSON.stringify(groups) + ' count=' + ctxs.length);
    for (const cc of ctxs) {
      const t = (cc.content||'');
      if (t.includes(runId)) console.log('   [MINE]', t.slice(0, 100));
    }
  }
}
go().catch(e => { console.error('ERR', e.message); });
