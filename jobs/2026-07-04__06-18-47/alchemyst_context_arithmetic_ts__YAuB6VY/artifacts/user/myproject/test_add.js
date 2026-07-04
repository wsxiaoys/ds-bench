const AlchemystAI = require('@alchemystai/sdk').default;
async function go() {
  const c = new AlchemystAI({ apiKey: process.env.ALCHEMYST_AI_API_KEY });
  try {
    const r = await c.v1.context.add({
      context_type: 'resource',
      scope: 'internal',
      source: 'platform.api.context.add',
      documents: [{ content: 'TEST ENGINEERING V1 ENG_V1_DOC engineering notes' }],
      metadata: {
        fileName: 'TEST-zr1thi7n2p.md',
        fileType: 'text/markdown',
        fileSize: 100,
        lastModified: new Date().toISOString(),
        groupName: ['test', 'eng', 'v1']
      }
    });
    console.log('OK', r);
  } catch (e) {
    console.error('ERR', e.status, e.message);
    console.error('BODY', e.error);
  }
}
go();
