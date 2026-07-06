const AlchemystAI = require('@alchemystai/sdk').default;
async function go() {
  const c = new AlchemystAI({ apiKey: process.env.ALCHEMYST_AI_API_KEY });
  // Add with snake_case group_name (per task spec)
  const runId = 'Z_' + Date.now();
  for (const s of [
    { key: 'ENG_V1_DOC', groups: ['eng','v1'], content: 'ENG_V1_DOC_UNIQ_XYZ engineering notes for API version 1' },
    { key: 'ENG_V2_DOC', groups: ['eng','v2'], content: 'ENG_V2_DOC_UNIQ_XYZ engineering notes for API version 2' },
    { key: 'PRODUCT_V1_DOC', groups: ['product','v1'], content: 'PRODUCT_V1_DOC_UNIQ_XYZ product notes release version 1' },
    { key: 'PRODUCT_V2_DOC', groups: ['product','v2'], content: 'PRODUCT_V2_DOC_UNIQ_XYZ product notes release version 2' },
  ]) {
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
  console.log('ingested runId=' + runId);
  for (let wait = 0; wait < 30; wait++) {
    await new Promise(r=>setTimeout(r, 2000));
    const r = await c.v1.context.search({
      query: 'ENG_V1_DOC_UNIQ_XYZ engineering',
      similarity_threshold: 0.1,
      minimum_similarity_threshold: 0.05,
      scope: 'internal',
      body_metadata: { groupName: ['eng','v1'] },
    });
    const ctxs = (r && r.contexts) || [];
    const mine = ctxs.filter(c => (c.content||'').includes('UNIQ_XYZ'));
    console.log('wait=' + (wait*2+2) + 's count=' + ctxs.length + ' MINE=' + mine.length);
    for (const m of mine) console.log('   ', (m.content||'').slice(0, 100));
    if (mine.length > 0 && (mine[0].content||'').includes('V1_DOC_UNIQ_XYZ')) break;
  }
}
go().catch(e => { console.error('ERR', e.message); });
